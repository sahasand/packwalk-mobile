---
description: Use this skill when the user asks to "security review", "check auth", "OWASP check", "check for vulnerabilities", "security audit", or needs security quality control on Packwalk code.
---

# Security Review - Packwalk

Review code for security vulnerabilities and auth issues.

## Packwalk Security Architecture

- **Clerk** for authentication (OAuth: Apple, Google)
- **Convex auth guards** for authorization
- **Stripe** for payment security (PCI compliant)
- **HTTPS only** for all external communication

## Key Files

| File | Purpose |
|------|---------|
| `convex/lib/guards.ts` | Auth guards: requireUser, requireOwner, requireWalker |
| `convex/lib/errors.ts` | Safe error handling |
| `convex/http.ts` | Webhook signature verification |
| `app/(auth)/` | Authentication screens |

## Review Checklist

### Authentication

- [ ] All protected routes require authentication
- [ ] Token validation on every request (Convex handles via `ctx.auth`)
- [ ] No auth bypass in development code
- [ ] Session handling follows Clerk patterns

### Authorization

- [ ] Every mutation checks user owns the resource
- [ ] Role checks: `requireOwner()` or `requireWalker()`
- [ ] Walker verification status checked: `walkerVerificationStatus === 'approved'`
- [ ] No privilege escalation paths
- [ ] Internal mutations use `internalMutation` (no user context)

### Input Validation

- [ ] All inputs validated with Convex validators (`v.string()`, `v.number()`, etc.)
- [ ] IDs validated with `v.id('tableName')`
- [ ] String lengths bounded where appropriate
- [ ] Numbers in expected ranges
- [ ] No raw user input in database queries

### Sensitive Data

- [ ] No secrets in code (API keys, passwords)
- [ ] Secrets from environment variables only
- [ ] No PII logged to console
- [ ] Sensitive notes encrypted (`sensitiveNotes`, `sensitiveNotesIv`)
- [ ] Email/phone not exposed in public queries

### OWASP Top 10 Checks

| Vulnerability | Check |
|---------------|-------|
| Injection | Convex validators prevent; no raw SQL |
| Broken Auth | Guards on all mutations |
| Sensitive Data | PII protected, encryption used |
| XXE | Not applicable (no XML) |
| Broken Access Control | Ownership verified |
| Misconfiguration | Env vars for secrets |
| XSS | React auto-escapes; no dangerouslySetInnerHTML |
| Insecure Deserialization | Convex handles safely |
| Vulnerable Components | Keep dependencies updated |
| Logging | No sensitive data logged |

### API Security

- [ ] Webhook signatures verified before processing
- [ ] Rate limiting on sensitive endpoints
- [ ] Idempotency keys prevent duplicate operations
- [ ] Error messages don't leak internal details

### Mobile Security

- [ ] No secrets in app bundle
- [ ] Secure storage for tokens (Expo SecureStore)
- [ ] Certificate pinning considered
- [ ] Deep link validation

## Common Issues in Packwalk

1. **Missing ownership check** - Mutation doesn't verify `resource.ownerId === user._id`
2. **Walker status not checked** - Operations without `walkerVerificationStatus === 'approved'`
3. **Exposed PII** - Public query returning email/phone
4. **Hardcoded secret** - API key in code instead of env var
5. **Missing rate limit** - Sensitive operation without `rateLimit()`

## Example Patterns

### Correct Ownership Check
```typescript
const dog = await ctx.db.get(args.dogId);
if (!dog || dog.ownerId !== user._id || dog.isDeleted) {
  packwalkError('validation/error', 'Dog not found');
}
```

### Correct Walker Verification
```typescript
const walker = await requireUser(ctx);
requireWalker(walker);
if (walker.walkerVerificationStatus !== 'approved') {
  packwalkError('auth/forbidden', 'Walker not approved');
}
```

### Correct Public Query (No PII)
```typescript
export const getPublicProfile = query({
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.isDeleted) return null;

    // Only return public fields - NO email, phone, authId
    return {
      _id: user._id,
      name: user.name,
      avatarUrl: user.avatarUrl,
      userType: user.userType,
    };
  },
});
```

### Correct Webhook Verification
```typescript
const sig = request.headers.get('stripe-signature');
if (!sig) {
  return new Response('Missing signature', { status: 400 });
}

const event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
// Now safe to process
```
