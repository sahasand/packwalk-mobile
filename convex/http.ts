import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { api } from './_generated/api';
import { internal } from './_generated/api';
import { stripeWebhook } from './stripeHttp';
import { getErrorInfo } from './lib/errors';
import type { Id } from './_generated/dataModel';

const http = httpRouter();

// Constant-time string equality. Using `===` for signature comparison short-circuits
// on the first mismatched byte, leaking timing information about correct prefix length
// to a network attacker (theoretical for HTTPS endpoints but trivial to avoid).
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// Helper to verify HMAC-SHA256 signature (hex format)
async function verifyHmacSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const expectedSignature = Array.from(new Uint8Array(signatureBytes))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return timingSafeEqual(signature.toLowerCase(), expectedSignature.toLowerCase());
  } catch {
    return false;
  }
}

// Decode Svix secret (handles whsec_ prefix and base64 encoding)
function decodeSvixSecret(secret: string): Uint8Array {
  // Svix secrets are prefixed with 'whsec_' and base64 encoded
  let base64Secret = secret;
  if (base64Secret.startsWith('whsec_')) {
    base64Secret = base64Secret.slice(6); // Remove 'whsec_' prefix
  }
  // Decode base64 to bytes
  const binaryString = atob(base64Secret);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Helper to verify HMAC-SHA256 signature for Svix (base64 format)
async function verifySvixSignature(
  payload: string,
  signatureBase64: string,
  secret: string
): Promise<boolean> {
  try {
    // Decode the secret (handles whsec_ prefix)
    const secretBytes = decodeSvixSecret(secret);

    const key = await crypto.subtle.importKey(
      'raw',
      secretBytes.buffer as ArrayBuffer, // Cast to fix TypeScript type issue
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const encoder = new TextEncoder();
    const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));

    // Convert signature bytes to base64
    const byteArray = Array.from(new Uint8Array(signatureBytes));
    const expectedSignatureBase64 = btoa(String.fromCharCode(...byteArray));

    return timingSafeEqual(signatureBase64, expectedSignatureBase64);
  } catch {
    return false;
  }
}

http.route({
  path: '/stripe/webhook',
  method: 'POST',
  handler: stripeWebhook,
});

// Background location tracking endpoint for walker apps
// Maximum points per batch - aligned with walks.appendLocationsBatch limit
const MAX_POINTS_PER_BATCH = 50;

http.route({
  path: '/location/batch',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      // Verify authenticated identity via Convex auth
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const payload = await request.json();
      const { walkId, points } = payload;

      // Validate required fields
      if (!walkId || typeof walkId !== 'string') {
        return new Response(JSON.stringify({ error: 'Invalid walkId' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (!points || !Array.isArray(points)) {
        return new Response(JSON.stringify({ error: 'Invalid points array' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Cap points to prevent abuse
      if (points.length > MAX_POINTS_PER_BATCH) {
        return new Response(
          JSON.stringify({
            error: `Too many points. Maximum ${MAX_POINTS_PER_BATCH} per batch.`,
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Validate each point has required fields (frontend sends lat/lng)
      for (const point of points) {
        if (
          typeof point.lat !== 'number' ||
          typeof point.lng !== 'number' ||
          typeof point.timestamp !== 'number'
        ) {
          return new Response(
            JSON.stringify({ error: 'Invalid point format' }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }
      }

      // Call the batch location mutation (mutation verifies walk ownership)
      await ctx.runMutation(api.walks.appendLocationsBatch, {
        walkId: walkId as Id<'walks'>,
        points,
      });

      return new Response(JSON.stringify({ success: true, count: points.length }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error: unknown) {
      // Parse error to return appropriate status code and message
      const errInfo = getErrorInfo(error);
      const errorMessage = errInfo.message;
      console.error('Location batch error:', errorMessage);

      // Determine appropriate status code based on error type
      let statusCode = 500;
      let errorCode = 'unknown';

      if (errorMessage.includes('accuracy')) {
        statusCode = 400;
        errorCode = 'accuracy_low';
      } else if (errorMessage.includes('too old') || errorMessage.includes('stale')) {
        statusCode = 400;
        errorCode = 'timestamp_stale';
      } else if (errorMessage.includes('future')) {
        statusCode = 400;
        errorCode = 'timestamp_future';
      } else if (errorMessage.includes('rate') || errorMessage.includes('Too many')) {
        statusCode = 429;
        errorCode = 'rate_limited';
      } else if (errorMessage.includes('not in progress') || errorMessage.includes('Walk not found')) {
        statusCode = 400;
        errorCode = 'walk_not_active';
      } else if (errorMessage.includes('forbidden') || errorMessage.includes('Not allowed')) {
        statusCode = 403;
        errorCode = 'unauthorized';
      } else if (errorMessage.includes('jump')) {
        statusCode = 400;
        errorCode = 'location_jump';
      }

      return new Response(
        JSON.stringify({
          error: errorMessage,
          code: errorCode,
        }),
        {
          status: statusCode,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
  }),
});

http.route({
  path: '/certn/webhook',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    // SECURITY: Verify webhook signature
    const secret = process.env.CERTN_WEBHOOK_SECRET;
    if (!secret) {
      console.error('CERTN_WEBHOOK_SECRET not configured - rejecting webhook request');
      return new Response('Webhook secret not configured', { status: 500 });
    }

    const signature = request.headers.get('x-certn-signature') || request.headers.get('x-signature');
    const payloadText = await request.text();

    if (!signature || !(await verifyHmacSignature(payloadText, signature, secret))) {
      return new Response('Invalid signature', { status: 401 });
    }

    const payload = JSON.parse(payloadText);
    await ctx.runMutation(internal.webhooks.record, {
      provider: 'certn',
      eventType: payload.type ?? 'unknown',
      eventId: payload.id ?? `${Date.now()}`,
      payload,
    });

    return new Response('ok', { status: 200 });
  }),
});

http.route({
  path: '/resend/webhook',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    // SECURITY: Verify Resend/Svix webhook signature
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!secret) {
      console.error('RESEND_WEBHOOK_SECRET not configured - rejecting webhook request');
      return new Response('Webhook secret not configured', { status: 500 });
    }

    const svixId = request.headers.get('svix-id');
    const svixTimestamp = request.headers.get('svix-timestamp');
    const svixSignature = request.headers.get('svix-signature');
    const payloadText = await request.text();

    if (!svixId || !svixTimestamp || !svixSignature) {
      return new Response('Missing Svix headers', { status: 401 });
    }

    // Verify timestamp is within 5 minutes (300 seconds)
    const timestamp = parseInt(svixTimestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    const TOLERANCE_SECONDS = 300;

    if (Math.abs(now - timestamp) > TOLERANCE_SECONDS) {
      return new Response('Timestamp outside tolerance window', { status: 401 });
    }

    // Svix signature format: v1,<base64_signature>
    const signedPayload = `${svixId}.${svixTimestamp}.${payloadText}`;
    const signatures = svixSignature.split(' ');
    let verified = false;

    for (const sig of signatures) {
      const [version, sigValue] = sig.split(',');
      if (version === 'v1' && sigValue) {
        // Use base64 verification for Svix
        if (await verifySvixSignature(signedPayload, sigValue, secret)) {
          verified = true;
          break;
        }
      }
    }

    if (!verified) {
      return new Response('Invalid signature', { status: 401 });
    }

    const payload = JSON.parse(payloadText);
    await ctx.runMutation(internal.webhooks.record, {
      provider: 'resend',
      eventType: payload.type ?? 'unknown',
      eventId: payload.id ?? `${Date.now()}`,
      payload,
    });

    return new Response('ok', { status: 200 });
  }),
});

// Stripe Connect return URL - redirects to app deep link
http.route({
  path: '/stripe/connect-return',
  method: 'GET',
  handler: httpAction(async () => {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Setup Complete - Packwalk</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: linear-gradient(135deg, #FDF6F3 0%, #F5EBE6 100%); padding: 20px; }
    .container { text-align: center; padding: 40px 30px; background: white; border-radius: 24px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); max-width: 360px; width: 100%; }
    .icon { font-size: 64px; margin-bottom: 16px; }
    h1 { color: #1a1a1a; font-size: 24px; margin: 0 0 8px 0; font-weight: 600; }
    p { color: #666; margin: 0 0 24px 0; font-size: 16px; line-height: 1.5; }
    .btn { display: block; width: 100%; padding: 16px 24px; background: #E07A5F; color: white; text-decoration: none; border-radius: 12px; font-size: 17px; font-weight: 600; transition: transform 0.1s, background 0.2s; }
    .btn:active { transform: scale(0.98); background: #c96a52; }
    .hint { margin-top: 16px; font-size: 13px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">✅</div>
    <h1>Payout Setup Complete!</h1>
    <p>Your Stripe account is ready to receive payments from dog walks.</p>
    <a href="packwalk://stripe-connect-return" class="btn">Return to Packwalk</a>
    <p class="hint">Tap the button above to go back to the app</p>
  </div>
</body>
</html>`;
    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });
  }),
});

// Stripe Connect refresh URL - redirects to app deep link
http.route({
  path: '/stripe/connect-refresh',
  method: 'GET',
  handler: httpAction(async () => {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Session Expired - Packwalk</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: linear-gradient(135deg, #FDF6F3 0%, #F5EBE6 100%); padding: 20px; }
    .container { text-align: center; padding: 40px 30px; background: white; border-radius: 24px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); max-width: 360px; width: 100%; }
    .icon { font-size: 64px; margin-bottom: 16px; }
    h1 { color: #1a1a1a; font-size: 24px; margin: 0 0 8px 0; font-weight: 600; }
    p { color: #666; margin: 0 0 24px 0; font-size: 16px; line-height: 1.5; }
    .btn { display: block; width: 100%; padding: 16px 24px; background: #E07A5F; color: white; text-decoration: none; border-radius: 12px; font-size: 17px; font-weight: 600; transition: transform 0.1s, background 0.2s; }
    .btn:active { transform: scale(0.98); background: #c96a52; }
    .hint { margin-top: 16px; font-size: 13px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">⏰</div>
    <h1>Session Expired</h1>
    <p>Your setup session timed out. Please return to the app and try again.</p>
    <a href="packwalk://stripe-connect-refresh" class="btn">Return to Packwalk</a>
    <p class="hint">Tap the button above to go back to the app</p>
  </div>
</body>
</html>`;
    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });
  }),
});

export default http;
