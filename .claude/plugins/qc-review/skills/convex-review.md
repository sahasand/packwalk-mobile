---
description: Use this skill when the user asks to "review convex", "check mutation", "check query", "backend review", "review database code", or needs quality control on Convex backend code in Packwalk.
---

# Convex Backend Review - Packwalk

Review Convex backend code against Packwalk patterns and best practices.

## Packwalk Convex Architecture

- **Auth guards** via `requireIdentity`, `requireUser`, `requireOwner`, `requireWalker`
- **Error handling** via `packwalkError()` helper
- **Rate limiting** via `rateLimit()` helper
- **Indexes** defined in `schema.ts` for query performance

## Key Files

| File | Purpose |
|------|---------|
| `convex/schema.ts` | Database schema and indexes |
| `convex/lib/guards.ts` | Auth guard functions |
| `convex/lib/errors.ts` | Error handling utilities |
| `convex/lib/rateLimit.ts` | Rate limiting |

## Review Checklist

### Authentication & Authorization

- [ ] All mutations use `requireUser(ctx)` or more specific guard
- [ ] Owner-only operations use `requireOwner(owner)`
- [ ] Walker-only operations use `requireWalker(walker)`
- [ ] Queries that expose user data check ownership
- [ ] `internalMutation`/`internalQuery` used for system operations (no user context)

### Query Patterns

- [ ] Uses index for filtered queries (`.withIndex()` not `.filter()` alone)
- [ ] Index exists in `schema.ts` for the query pattern
- [ ] Compound indexes match query order (e.g., `by_walkerId_status` for `walkerId` + `status`)
- [ ] `.first()` for single results, `.collect()` for lists
- [ ] `.take(N)` for limited results, never unbounded `.collect()` on large tables

### Mutation Patterns

- [ ] Validates all inputs before database operations
- [ ] Uses `packwalkError()` for user-facing errors
- [ ] Sets `createdAt` and `updatedAt` timestamps
- [ ] Soft delete uses `isDeleted: true` + `deletedAt` timestamp
- [ ] Status transitions validated (e.g., only `pending` → `accepted`)

### Data Validation

- [ ] Required fields checked with clear error messages
- [ ] IDs validated with `ctx.db.get()` before use
- [ ] Ownership verified (`dog.ownerId === user._id`)
- [ ] Status/enum values validated
- [ ] Numeric values in expected range (e.g., `hourlyRate > 0`)
- [ ] **Monetary/price fields have bounds** (min/max, integer cents, no negatives)

### Error Handling

- [ ] Uses `packwalkError(code, message)` not `throw new Error()`
- [ ] Error codes follow pattern: `'validation/error'`, `'auth/forbidden'`, `'state/invalid_transition'`
- [ ] Errors are user-friendly, not exposing internals

### Rate Limiting

- [ ] Sensitive operations rate-limited (e.g., `walkRequests:create`)
- [ ] Uses `rateLimit(ctx, subject, key, limit, windowSeconds)`
- [ ] Subject is user ID, key is operation name

### Indexes Required

| Query Pattern | Required Index |
|---------------|----------------|
| Users by auth | `by_authId` |
| Dogs by owner | `by_ownerId` |
| Walks by walker + status | `by_walkerId_status` |
| Walks by owner + status | `by_ownerId_status` |
| WalkRequests by expiry | `by_expiresAt` |

## Common Issues in Packwalk

1. **Missing index** - Query uses `.filter()` without `.withIndex()` first
2. **Auth guard missing** - Mutation doesn't verify user owns resource
3. **Unbounded collect** - `.collect()` on potentially large result set
4. **Raw throws** - Using `throw new Error()` instead of `packwalkError()`
5. **Status not validated** - Transition without checking current status
6. **Unbounded monetary fields** - Price/rate fields accept any number (should validate min/max bounds, integer cents)

## Example Patterns

### Correct Auth Pattern
```typescript
export const updateDog = mutation({
  args: { dogId: v.id('dogs'), name: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    requireOwner(user);

    const dog = await ctx.db.get(args.dogId);
    if (!dog || dog.ownerId !== user._id) {
      packwalkError('validation/error', 'Dog not found');
    }

    await ctx.db.patch(dog._id, {
      name: args.name,
      updatedAt: Date.now()
    });
  },
});
```

### Correct Query Pattern
```typescript
// Uses compound index correctly
const walks = await ctx.db
  .query('walks')
  .withIndex('by_walkerId_status', q =>
    q.eq('walkerId', walker._id).eq('status', 'scheduled')
  )
  .collect();
```

### Correct Status Transition
```typescript
if (request.status !== 'pending') {
  packwalkError('state/invalid_transition', 'Only pending requests can be accepted');
}
```
