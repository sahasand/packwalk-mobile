// Walk-scoped HMAC tokens for the background GPS upload endpoint.
//
// Why this exists: OAuth ID tokens from Google/Apple expire ~1 hour and cannot
// be refreshed client-side (see lib/useConvexAuth.ts). On walks longer than
// the token lifetime, the /location/batch endpoint would 401 and the
// background task would mark itself permanently failed, dropping all
// subsequent GPS points.
//
// Walk-scoped tokens decouple location uploads from user-session lifetime.
// The token is signed at walk start, carries (walkId, walkerId, expiresAt)
// in the clear, and is verified by HMAC at the endpoint. Token scope:
// - Bound to a single walk — can only upload points for that walkId
// - Expires 12 hours after walk start — well beyond any plausible walk
// - Becomes useless when the walk transitions out of in_progress (the
//   endpoint also checks walk status before inserting points)
//
// Format: `${walkId}:${walkerId}:${expiresAt}:${signature}` where signature
// is the URL-safe base64 of HMAC-SHA256(`${walkId}:${walkerId}:${expiresAt}`,
// LOCATION_TOKEN_SECRET). Convex Ids are alphanumeric so `:` is a safe
// separator.

const TOKEN_LIFETIME_MS = 12 * 60 * 60 * 1000;

function base64UrlEncode(bytes: Uint8Array): string {
  let str = '';
  for (let i = 0; i < bytes.length; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmacSign(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return base64UrlEncode(new Uint8Array(sigBytes));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function getSecret(): string {
  const secret = process.env.LOCATION_TOKEN_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'LOCATION_TOKEN_SECRET env var is missing or too short (need 32+ chars). ' +
        'Set it with: npx convex env set LOCATION_TOKEN_SECRET <random-hex>',
    );
  }
  return secret;
}

export async function signWalkToken(args: {
  walkId: string;
  walkerId: string;
}): Promise<string> {
  const secret = getSecret();
  const expiresAt = Date.now() + TOKEN_LIFETIME_MS;
  const payload = `${args.walkId}:${args.walkerId}:${expiresAt}`;
  const signature = await hmacSign(payload, secret);
  return `${payload}:${signature}`;
}

// Returns null for any verification failure (malformed, bad signature,
// expired, secret unset). Endpoint should treat null as 401.
export async function verifyWalkToken(
  token: string,
): Promise<{ walkId: string; walkerId: string } | null> {
  let secret: string;
  try {
    secret = getSecret();
  } catch {
    return null;
  }
  const parts = token.split(':');
  if (parts.length !== 4) return null;
  const [walkId, walkerId, expiresAtStr, signature] = parts;
  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;
  const payload = `${walkId}:${walkerId}:${expiresAt}`;
  const expectedSignature = await hmacSign(payload, secret);
  if (!timingSafeEqual(signature, expectedSignature)) return null;
  return { walkId, walkerId };
}
