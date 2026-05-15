---
description: Use this skill when the user asks to "performance review", "check re-renders", "optimize", "check performance", "slow component", or needs performance quality control on Packwalk code.
---

# Performance Review - Packwalk

Review code for performance issues and optimization opportunities.

## Packwalk Performance Considerations

- **Convex real-time** - Queries auto-update, avoid unnecessary re-fetches
- **React Native** - 60fps target, minimize bridge crossings
- **Lists** - FlatList for long lists, not ScrollView with map
- **Images** - Optimized via Cloudinary, cached locally

## Review Checklist

### React Re-renders

- [ ] `useMemo` for expensive computations
- [ ] `useCallback` for functions passed to children
- [ ] Component splits to isolate re-renders
- [ ] No object/array literals in JSX props
- [ ] Keys are stable (not array index for dynamic lists)

### Query Optimization

- [ ] Convex queries return minimal data needed
- [ ] No N+1 queries (use enriched queries or batch)
- [ ] Conditional queries use `'skip'` to avoid unnecessary calls
- [ ] Heavy queries use `.take(limit)` not unbounded `.collect()`

### List Performance

- [ ] `FlatList` for lists > 10 items
- [ ] `keyExtractor` returns stable, unique keys
- [ ] `renderItem` doesn't create new functions
- [ ] `getItemLayout` for fixed-height items
- [ ] `initialNumToRender` set appropriately

### Image Optimization

- [ ] Images sized appropriately (not loading 4K for thumbnails)
- [ ] Cloudinary transformations used (width, height, quality)
- [ ] `Image` component caches properly
- [ ] Placeholder/loading state for images

### Memory Management

- [ ] `useEffect` cleanup for timers, subscriptions, listeners
- [ ] No memory leaks from forgotten intervals
- [ ] Large data not held in state unnecessarily
- [ ] Listeners removed on unmount

### Animation Performance

- [ ] `react-native-reanimated` for complex animations
- [ ] Animations run on UI thread (worklets)
- [ ] No layout thrashing during animations
- [ ] `useNativeDriver: true` where applicable

### Bundle Size

- [ ] No unused imports
- [ ] Large libraries imported selectively
- [ ] Images optimized (not 5MB PNGs)
- [ ] Dev-only code tree-shaken

## Common Issues in Packwalk

1. **Inline object props** - `style={{ padding: 16 }}` creates new object every render
2. **Missing useMemo** - Expensive sort/filter runs on every render
3. **ScrollView with map** - Should be FlatList for list of walks
4. **Missing useEffect cleanup** - Timer leaks on navigation
5. **N+1 queries** - Fetching owner for each walk separately

## Example Patterns

### Correct useMemo
```typescript
const sortedWalks = useMemo(() => {
  if (!walks) return [];
  return walks
    .filter(w => w.status === 'scheduled')
    .sort((a, b) => a.scheduledTime - b.scheduledTime);
}, [walks]);
```

### Correct useCallback
```typescript
const handleStartWalk = useCallback((walkId: string) => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  router.push({
    pathname: '/(walker)/active-walk',
    params: { walkId },
  });
}, [router]);
```

### Correct FlatList
```typescript
<FlatList
  data={walks}
  keyExtractor={(item) => item._id}
  renderItem={({ item }) => <WalkCard walk={item} />}
  initialNumToRender={5}
  maxToRenderPerBatch={10}
  windowSize={5}
/>
```

### Correct Conditional Query
```typescript
// Don't fetch walker profile until we have the walk
const walkerProfile = useAuthQuery(
  api.walkerProfiles.getPublicByUserId,
  walk ? { userId: walk.walkerId } : 'skip'
);
```

### Correct useEffect Cleanup
```typescript
useEffect(() => {
  if (walk?.status !== 'in_progress') return;

  const timer = setInterval(() => {
    setTick(t => t + 1);
  }, 1000);

  return () => clearInterval(timer);
}, [walk?.status]);
```

### Avoid: Inline Object Props
```typescript
// BAD - creates new object every render
<View style={{ padding: spacing.md }}>

// GOOD - reference from StyleSheet
<View style={styles.container}>
```

### Avoid: N+1 Queries
```typescript
// BAD - fetches owner for each walk
walks.map(walk => {
  const owner = useAuthQuery(api.users.getById, { userId: walk.ownerId });
  // ...
});

// GOOD - use enriched query that includes owner data
const walks = useAuthQuery(api.walks.listMineWalkerEnriched, { status: 'scheduled' });
// walks[0].ownerName, walks[0].ownerAvatar already included
```
