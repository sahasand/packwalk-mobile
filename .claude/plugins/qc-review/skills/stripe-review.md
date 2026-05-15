---
description: Use this skill when the user asks to "review stripe", "check payment code", "review webhook", "check Connect integration", or needs quality control on Stripe-related code in Packwalk.
---

# Stripe Integration Review - Packwalk

Review Stripe integration code against Packwalk patterns and best practices.

## Packwalk Stripe Architecture

- **PaymentSheet** for owner checkout (card/Apple Pay/Google Pay)
- **Manual capture** - authorize on book, capture on walker accept
- **Stripe Connect Express** for walker payouts (80% to walker, 20% platform)
- **Webhooks** at `convex/http.ts` → `/stripe/webhook`

## Key Files

| File | Purpose |
|------|---------|
| `convex/payments.ts` | Payment intents, capture, refunds, Connect |
| `convex/http.ts` | Webhook endpoint, signature verification |
| `convex/webhookEvents.ts` | Idempotent event processing |
| `lib/stripe.ts` | Client-side Stripe initialization |

## Review Checklist

### Payment Intents

- [ ] Uses `capture_method: 'manual'` for authorization holds
- [ ] Includes `stripeIdempotencyKey` to prevent duplicate charges
- [ ] Stores `stripePaymentIntentId` on walkRequest/walk records
- [ ] Handles `requires_payment_method`, `requires_confirmation`, `succeeded` states
- [ ] Currency is lowercase (`'cad'` not `'CAD'`)

### Stripe Connect

- [ ] Checks `user.stripeConnectStatus === 'active'` before transfers
- [ ] Uses `stripeConnectAccountId` from user record
- [ ] Handles Connect onboarding states: `not_started`, `onboarding`, `pending_verification`, `active`, `restricted`, `disabled`
- [ ] Platform fee calculated correctly (20% = `platformFeePercent: 0.2`)

### Webhooks

- [ ] Signature verification with `stripe.webhooks.constructEvent()`
- [ ] Idempotency check via `webhookEvents` table before processing
- [ ] Status set to `'processing'` before work, `'processed'` after
- [ ] Error handling updates status to `'failed'` with `errorMessage`
- [ ] Events handled: `account.updated`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`

### Error Handling

- [ ] Stripe errors logged to `stripeErrors` table with context
- [ ] User-friendly error messages (not raw Stripe errors)
- [ ] Retry logic for transient failures
- [ ] `packwalkError()` used for application errors, not Stripe SDK errors

### Security

- [ ] Webhook secret from environment variable, not hardcoded
- [ ] No Stripe secret key in client code
- [ ] Test keys (`sk_test_`) not in production code
- [ ] Customer IDs validated before use

## Common Issues in Packwalk

1. **Missing idempotency key** - Always use `stripeIdempotencyKey` field
2. **Capture before accept** - Payment captured in `acceptWalkRequestWithCapture`, not before
3. **Connect status not checked** - Verify walker has `stripeConnectStatus: 'active'`
4. **Webhook replay** - Must check `webhookEvents` for duplicate `eventId`

## Example Patterns

### Correct Payment Capture
```typescript
// convex/payments.ts - acceptWalkRequestWithCapture
const paymentIntent = await stripe.paymentIntents.capture(
  request.stripePaymentIntentId,
  { idempotencyKey: `capture_${request._id}` }
);
```

### Correct Webhook Processing
```typescript
// Check idempotency first
const existing = await ctx.db
  .query('webhookEvents')
  .withIndex('by_provider_eventId', q =>
    q.eq('provider', 'stripe').eq('eventId', event.id)
  )
  .first();
if (existing) return { status: 'already_processed' };
```
