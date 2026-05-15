---
description: Use this skill when the user asks to "typescript review", "check types", "type safety", "review typescript", "check generics", or needs TypeScript quality control on Packwalk code.
---

# TypeScript Review - Packwalk

Review TypeScript code for type safety and best practices.

## Packwalk TypeScript Setup

- **Strict mode** enabled in `tsconfig.json`
- **Convex types** auto-generated in `convex/_generated/`
- **Path aliases** via `@/` for clean imports

## Key Files

| File | Purpose |
|------|---------|
| `tsconfig.json` | TypeScript configuration |
| `convex/_generated/dataModel.d.ts` | Database types |
| `convex/_generated/api.d.ts` | API types |

## Review Checklist

### Type Safety

- [ ] No `any` types (use `unknown` if truly unknown)
- [ ] No `@ts-ignore` or `@ts-expect-error` without justification
- [ ] No non-null assertions (`!`) without certainty
- [ ] Explicit return types on exported functions
- [ ] Generics used where types vary

### Convex Types

- [ ] Uses `Id<'tableName'>` for document IDs
- [ ] Uses `Doc<'tableName'>` for document types
- [ ] Mutation/query args match schema validators
- [ ] `v.optional()` fields handled as potentially undefined

### React Types

- [ ] Props interfaces defined for components
- [ ] Event handlers typed correctly
- [ ] Refs typed with correct element type
- [ ] Children typed as `React.ReactNode` when needed

### Null Handling

- [ ] Optional chaining (`?.`) for potentially null values
- [ ] Nullish coalescing (`??`) for defaults
- [ ] Type guards for narrowing
- [ ] Early returns for null checks

### Enums and Unions

- [ ] String unions preferred over enums for Convex compatibility
- [ ] Discriminated unions for state machines
- [ ] Exhaustive checks with `never` in switches

### Import/Export

- [ ] Named exports preferred (better tree-shaking)
- [ ] Type imports use `import type` where possible
- [ ] No circular dependencies
- [ ] Path aliases used (`@/` not `../../`)

## Common Issues in Packwalk

1. **Casting instead of narrowing** - Using `as` instead of type guard
2. **Missing undefined check** - Optional field used without `?.`
3. **Wrong ID type** - Using `string` instead of `Id<'walks'>`
4. **Any in catch** - `catch (error)` without typing
5. **Implicit any** - Missing parameter types

## Example Patterns

### Correct ID Type
```typescript
import type { Id, Doc } from '@/convex/_generated/dataModel';

function processWalk(walkId: Id<'walks'>) {
  // walkId is typed correctly
}
```

### Correct Type Guard
```typescript
// Type guard function
function isWalkInProgress(walk: Doc<'walks'>): walk is Doc<'walks'> & { startedAt: number } {
  return walk.status === 'in_progress' && walk.startedAt !== undefined;
}

// Usage
if (isWalkInProgress(walk)) {
  const elapsed = Date.now() - walk.startedAt; // startedAt guaranteed
}
```

### Correct Error Handling
```typescript
try {
  await mutation();
} catch (error) {
  if (error instanceof Error) {
    toast.show(error.message, 'error');
  } else {
    toast.show('An unexpected error occurred', 'error');
  }
}
```

### Correct Optional Handling
```typescript
// Optional chaining + nullish coalescing
const displayName = user?.name ?? 'Anonymous';
const avatarUrl = profile?.avatarUrl ?? undefined;

// Early return pattern
const dog = await ctx.db.get(args.dogId);
if (!dog) {
  packwalkError('validation/error', 'Dog not found');
}
// dog is now non-null
```

### Correct Props Interface
```typescript
interface WalkCardProps {
  walk: Doc<'walks'> & {
    ownerName: string;
    dogNames: string[];
  };
  onPress?: (walkId: Id<'walks'>) => void;
}

function WalkCard({ walk, onPress }: WalkCardProps) {
  // ...
}
```

### Correct Discriminated Union
```typescript
type WalkStatus =
  | { status: 'scheduled'; scheduledTime: number }
  | { status: 'in_progress'; startedAt: number }
  | { status: 'completed'; completedAt: number };

function getWalkDuration(walk: WalkStatus): number | null {
  switch (walk.status) {
    case 'scheduled':
      return null;
    case 'in_progress':
      return Date.now() - walk.startedAt;
    case 'completed':
      return walk.completedAt - walk.startedAt;
    default:
      const _exhaustive: never = walk;
      return _exhaustive;
  }
}
```

### Avoid: Unsafe Patterns
```typescript
// BAD - using any
const data: any = response.data;

// GOOD - use unknown and validate
const data: unknown = response.data;
if (isValidResponse(data)) {
  // data is now typed
}

// BAD - non-null assertion without certainty
const walkId = params.walkId!;

// GOOD - check first
const walkId = params.walkId;
if (!walkId) {
  router.back();
  return;
}
```
