---
description: Use this skill when the user asks to "review component", "check screen", "RN review", "react native review", "expo review", or needs quality control on React Native/Expo code in Packwalk.
---

# React Native Review - Packwalk

Review React Native/Expo code against Packwalk patterns and best practices.

## Packwalk RN Architecture

- **Expo Router** for file-based navigation
- **Convex** for real-time data via `useAuthQuery`, `useAuthMutation`, `useAuthAction`
- **Zustand** for UI state (`stores/appStore.ts`)
- **Design system** in `constants/theme.ts`
- **UI components** in `components/ui/`

## Key Files

| File | Purpose |
|------|---------|
| `lib/useAuthQuery.ts` | Auth-aware Convex hooks |
| `stores/appStore.ts` | Zustand global state |
| `constants/theme.ts` | Colors, spacing, typography |
| `components/ui/index.ts` | Shared UI components |

## Review Checklist

### Data Fetching

- [ ] Uses `useAuthQuery` not raw `useQuery` (skips when not logged in)
- [ ] Uses `useAuthMutation` not raw `useMutation`
- [ ] Handles loading state (`data === undefined`)
- [ ] Handles empty state (`data.length === 0`)
- [ ] Uses `'skip'` parameter correctly for conditional queries

### State Management

- [ ] Server data from Convex, not duplicated in Zustand
- [ ] Zustand only for UI state (navigation, modals, auth flow)
- [ ] No stale state after mutations (Convex auto-updates)
- [ ] `useAppStore` with selector: `useAppStore(state => state.user)`

### Hooks Usage

- [ ] `useEffect` has cleanup function for subscriptions/timers
- [ ] `useEffect` dependencies are complete and correct
- [ ] `useMemo`/`useCallback` for expensive operations
- [ ] No hooks inside conditions or loops
- [ ] Custom hooks extract reusable logic

### Navigation (Expo Router)

- [ ] Uses `router.push()` for forward navigation
- [ ] Uses `router.replace()` when back shouldn't return
- [ ] Uses `router.back()` for back navigation
- [ ] Route params typed correctly
- [ ] Deep links considered for shared routes

### UI Patterns

- [ ] Uses theme tokens: `colors.ember`, `spacing.md`, `typography.sizes.lg`
- [ ] Uses UI components: `Card`, `Button`, `Avatar`, `Badge`
- [ ] Safe area handled: `useSafeAreaInsets()`
- [ ] Loading states show `SkeletonLoader` or `ActivityIndicator`
- [ ] Empty states use `EmptyState` component

### Styling

- [ ] Uses `StyleSheet.create()` not inline styles
- [ ] Colors from `colors.*` not hardcoded hex
- [ ] Spacing from `spacing.*` not hardcoded numbers
- [ ] Typography from `typography.*`
- [ ] Shadows from `shadows.*`

### Accessibility

- [ ] Interactive elements have `accessibilityRole`
- [ ] Buttons have `accessibilityLabel` if icon-only
- [ ] Images have alt text or `accessibilityLabel`
- [ ] Touch targets at least 44x44

### Error Handling

- [ ] Try/catch around async operations
- [ ] User-friendly error messages via `toast.show()`
- [ ] Loading state during async operations
- [ ] Graceful degradation on failure

## Common Issues in Packwalk

1. **Raw Convex hooks** - Using `useQuery` instead of `useAuthQuery`
2. **Missing loading state** - Not checking `data === undefined`
3. **Hardcoded colors** - Using `'#4A90A4'` instead of `colors.sage`
4. **Missing cleanup** - `useEffect` with timer/subscription but no cleanup
5. **Inline styles** - `style={{ padding: 16 }}` instead of StyleSheet

## Example Patterns

### Correct Data Fetching
```typescript
const walks = useAuthQuery(api.walks.listMine, { status: 'scheduled' });
const isLoading = walks === undefined;

if (isLoading) {
  return <SkeletonLoader variant="walkCard" />;
}

if (walks.length === 0) {
  return <EmptyState title="No walks scheduled" />;
}
```

### Correct useEffect with Cleanup
```typescript
useEffect(() => {
  if (walk?.status !== 'in_progress') return;

  const timer = setInterval(() => {
    setElapsed(Date.now() - walk.startedAt);
  }, 1000);

  return () => clearInterval(timer); // Cleanup!
}, [walk?.status, walk?.startedAt]);
```

### Correct Conditional Query
```typescript
// Skip query if no walkId
const walk = useAuthQuery(
  api.walks.getById,
  walkId ? { walkId: walkId as Id<'walks'> } : 'skip'
);
```

### Correct Styling
```typescript
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
    padding: spacing.lg,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.ink,
  },
});
```
