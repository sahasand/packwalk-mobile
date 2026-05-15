import { httpAction } from './_generated/server';
import { api, internal } from './_generated/api';

export const stripeWebhook = httpAction(async (ctx, request) => {
  const signature = request.headers.get('stripe-signature');
  const payloadText = await request.text();

  // Delegate to a Node action that can use Stripe SDK
  const result = await ctx.runAction(internal.payments.verifyAndParseStripeWebhook, {
    payload: payloadText,
    signature: signature ?? '',
  });

  if (!result.valid) {
    await ctx.runMutation(internal.webhooks.record, {
      provider: 'stripe',
      eventType: 'invalid',
      eventId: `${Date.now()}`,
      payload: { error: result.error ?? 'Invalid signature' },
    });
    return new Response('invalid signature', { status: 400 });
  }

  await ctx.runMutation(internal.webhooks.record, {
    provider: 'stripe',
    eventType: result.eventType!,
    eventId: result.eventId!,
    payload: result.data,
  });

  await ctx.runAction(internal.paymentsMutations.handleStripeEvent, {
    eventType: result.eventType!,
    eventId: result.eventId!,
    data: result.data,
  });

  return new Response('ok', { status: 200 });
});
