# Packwalk

Dog walking app for Toronto that donates 20% to local shelters. Built with React Native/Expo + Convex backend.

> **Note:** `web_html/` is a standalone landing page (packwalk.ca) with its own git repo. It is not part of this app and is gitignored.

**Status: TestFlight Beta** - Production build submitted to TestFlight, awaiting Apple review. Stripe Connect working. Real OAuth authentication only.

---

## Current State (2024-12-31)

### Complete
- [x] Owner flow: Dog management, walker search, booking with PaymentSheet
- [x] Walker flow: Dashboard, requests, active walk with GPS, earnings
- [x] Stripe PaymentSheet integration (card/Apple Pay/Google Pay)
- [x] **Stripe Connect for walker payouts** (Express accounts)
- [x] Walker onboarding flow (Set Up Payouts → Stripe hosted onboarding)
- [x] Payment capture on walk accept (tested end-to-end)
- [x] Webhook handling for `account.updated` events
- [x] Edit Profile screen with photo upload (owner + walker)
- [x] Impact section on profile (shows 20% donation total from completed walks)
- [x] Real-time chat, notifications
- [x] All backend functions working
- [x] Dev build installed on physical iPhone
- [x] **Custom floating paw navigation** (distinctive tab bars for owner/walker)
- [x] **Apple Sign-In working** (native iOS via expo-apple-authentication)
- [x] **Google Sign-In working** (OAuth via expo-auth-session)
- [x] **Dev scaffolding removed** - ~850 lines of dev-only code cleaned up
- [x] **Search uses user's location** - No more hardcoded "Downtown Toronto"
- [x] **Owner home screen** - Impact Card showing donation stats
- [x] **Profile name persistence** - Custom names preserved across logins (bootstrap fix)
- [x] **GPS tracking fixes** - Fixed critical race condition, permission handling, recovery flow
- [x] **Active Walk Banner** - Walker dashboard shows banner to return to in-progress walk
- [x] **Review/Tip System** - 80/20 split (walker/shelter), 7-day tip window, walker reviews screen
- [x] **Walker Stats Auto-Update** - avgRating and reviewCount update on every new review
- [x] **GPS tracking enhancements** - Logging, status indicator, token refresh for long walks
- [x] **Owner walk details** - Distance display, sorted newest first (limit 20)
- [x] **UI cleanup** - Removed non-functional Call button, cancel only for scheduled walks
- [x] **Unified Login Screen** - Combined onboarding + login into single "Living Canvas" screen
- [x] **Walker Profile Stats** - Shows real completed walk count and review count
- [x] **Review Names** - Shows owner's first name instead of initials (e.g., "Sandeep" not "SO.")

### Owner Profile Screen
- Edit Profile → Photo, name, phone, address
- My Dogs → Dog management
- Your Impact → Shows total donated to shelters (auto-calculated from completed walks)

---

## Running on Physical iPhone

### First-Time Setup

1. **Register device with Apple Developer Portal**
   - Get UDID: Connect iPhone to Mac → Finder → Click device info until UDID shows
   - Add at: https://developer.apple.com/account/resources/devices/add

2. **Register device with EAS**
   ```bash
   eas device:create
   # Select "Input" → Enter UDID manually
   ```

3. **Build for device**
   ```bash
   eas build --profile development-device --platform ios
   ```

4. **Install on iPhone**
   - Scan QR code from build output, or open the build URL on iPhone
   - Enable Developer Mode: Settings → Privacy & Security → Developer Mode → ON
   - Trust certificate: Settings → General → VPN & Device Management → Trust

### Daily Development

```bash
# Terminal 1 - Backend
npx convex dev

# Terminal 2 - Frontend (use tunnel for reliable connection)
npx expo start --dev-client --tunnel
```

Open Packwalk on iPhone → scans QR or auto-connects via tunnel.

**Note:** `--tunnel` is slower but reliable. If `--lan` works on your network, use that for faster reloads.

### Hot Reload
- Code changes auto-reload on device
- No rebuild needed unless adding native modules

---

## Quick Start (Simulator)

```bash
npm install
npx convex dev               # Terminal 1 - Backend
npx expo start --dev-client  # Terminal 2 - Frontend
# Press 'i' for iOS simulator
```

Required `.env.local`:
```
EXPO_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your-ios-client-id.apps.googleusercontent.com
```

---

## Next Steps

### Two-Phone Testing (Now)

Test with two devices using different OAuth accounts:
- **Phone 1 (Walker)**: Sign in with one Google/Apple account, complete Stripe Connect onboarding
- **Phone 2 (Owner)**: Sign in with different Google/Apple account, book the real walker

**Note:** One account = one role. Users cannot switch between owner/walker.

### Pre-Launch ✅ Complete
1. ~~**Stripe** - Switch to production keys~~ ✅ Done
2. ~~**Screenshots** - Capture App Store screenshots~~ ✅ Done (5 screens in `/screenshot`)
3. ~~**Build** - Run `eas build --profile production --platform ios`~~ ✅ Done
4. ~~**TestFlight** - Submit for external beta testing~~ ✅ Submitted, awaiting Apple review

### EAS Environment Variables (Production)
```
EXPO_PUBLIC_CONVEX_URL=https://earnest-minnow-363.convex.cloud
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=425824234148-...
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=425824234148-...
```

### Convex deployment

There is **one Convex backend**: `earnest-minnow-363.convex.cloud`. Despite the Convex CLI labeling it `dev:earnest-minnow-363` in `.env.local`, this is the only deployment that holds real data and env vars; both local development and TestFlight builds point at it.

The Convex project also has a "production" deployment slot, but it is **unused** (no env vars set, no traffic). Do not deploy there without first migrating env vars from the dev deployment.

To push backend code: `npx convex dev --once` (one-shot deploy to `earnest-minnow-363`) or run `npx convex dev` and leave it watching. Do **not** run `npx convex deploy` or `--prod` — that targets the unused prod deployment.

### Convex environment variables (server-side)

Set via `npx convex env set <KEY> <VALUE>`. Required for the backend to function:

```
AUTH_APPLE_CLIENT_ID         # Apple Sign-In bundle id (com.packwalk.app)
AUTH_APPLE_KEY_ID            # Apple p8 key id
AUTH_APPLE_TEAM_ID           # Apple team id
AUTH_APPLE_PRIVATE_KEY       # Contents of AuthKey_*.p8 (do not commit the .p8)
AUTH_GOOGLE_CLIENT_ID        # Google OAuth web client id (audience)
AUTH_GOOGLE_IOS_CLIENT_ID    # Google OAuth iOS client id (audience)
STRIPE_SECRET_KEY            # sk_live_... for production, sk_test_... for dev
STRIPE_WEBHOOK_SECRET        # whsec_... from Stripe webhook config
LOCATION_TOKEN_SECRET        # 32+ char hex string for walk-scoped GPS tokens (HMAC key)
RESEND_WEBHOOK_SECRET        # Svix webhook signing key for Resend (email events)
CERTN_WEBHOOK_SECRET         # HMAC signing key for Certn (background check, future)
```

To rotate `LOCATION_TOKEN_SECRET`:

```bash
# 1. Stash the current secret as the previous key (grace window for in-flight tokens)
OLD=$(npx convex env get LOCATION_TOKEN_SECRET)
npx convex env set LOCATION_TOKEN_SECRET_PREV "$OLD"

# 2. Generate and roll the new secret
npx convex env set LOCATION_TOKEN_SECRET "$(openssl rand -hex 32)"

# 3. Wait at least 12h (the token lifetime) so any in-flight walk tokens
#    signed under the old key get a chance to age out, then remove the prev:
npx convex env remove LOCATION_TOKEN_SECRET_PREV
```

`verifyWalkToken` accepts signatures under either key while `LOCATION_TOKEN_SECRET_PREV` is set; new signing always uses the current key.

### Future Enhancements (Post-MVP)
- Help & Support screen
- Stripe Customer Portal for payment method management
- Favorite Walkers quick-rebook
- Detailed Impact screen (shelters helped, community total)
- Notification preferences

---

## Architecture

### Routing
File-based routing via Expo Router:
- `app/(auth)/` - Unified login screen (Living Canvas design with animated value props)
- `app/(owner)/` - Dog owner screens
- `app/(walker)/` - Walker screens

### Navigation - Floating Paw Tab Bars
Custom floating tab bars with central paw FAB. Different behavior per user type:

**Owner** (`FloatingPawTabBar`): Home | Messages | 🐾 | Activity | Profile
- Central paw navigates to `/search` for booking walks (THE hero action)
- Messages tab shows unread badge count
- Profile tab uses icon (not user avatar - keeps visual consistency)

**Walker** (`FloatingPawTabBarWalker`): Home | Requests | 🐾 | Earnings | Profile
- Central paw toggles availability (online/offline) - not navigation
- Status bubble rises on tap with progressive disclosure
- Requests tab shows pending count badge
- Paw color: sage (online) / gray (offline) with pulse animation
- Profile tab uses icon (not user avatar)

Components: `components/navigation/FloatingPawTabBar.tsx`, `FloatingPawTabBarWalker.tsx`

### Login Screen - Living Canvas
Single unified screen combining onboarding + authentication (`app/(auth)/login.tsx`):

**Visual Elements:**
- Paw stamp entry animation (scales in, fades out)
- Floating paw constellation (3 paws drifting at different speeds)
- Gradient mesh background shifts with value prop cycling
- Auto-rotating value props (5s cycle): Trusted Walkers → Live Tracking → Save Rescues

**Functional Elements:**
- Role selector (Owner/Walker) with color-coded toggle
- Google Sign-In button
- Apple Sign-In button (iOS only)
- Terms footer

**Colors by state:** Ember (Owner/Trust), Sage (Walker/Tracking), Gold (Impact)

### Key Owner Screens
| Screen | File | Purpose |
|--------|------|---------|
| Home | `app/(owner)/index.tsx` | Dashboard, dogs list |
| Search | `app/(owner)/search.tsx` | Find walkers (uses user's location) |
| Booking | `app/(owner)/booking/[walkerId].tsx` | Book + PaymentSheet |
| Profile | `app/(owner)/profile.tsx` | Stats, impact, settings |
| Edit Profile | `app/(owner)/edit-profile.tsx` | Update name/phone/photo/address |
| Dog Editor | `app/(owner)/dog-editor.tsx` | Manage dogs |
| Review | `app/(owner)/review/[walkId].tsx` | Rate walk + tip |
| Walk Details | `app/(owner)/walk/[id].tsx` | View walk info, distance, cancel |
| Live Tracking | `app/(owner)/tracking/[id].tsx` | Real-time walk tracking |
| Walker Profile | `app/(owner)/walker/[id].tsx` | View walker details before booking |

### Key Walker Screens
| Screen | File | Purpose |
|--------|------|---------|
| Home | `app/(walker)/index.tsx` | Dashboard, availability toggle |
| Requests | `app/(walker)/requests.tsx` | Pending walk requests |
| Active Walk | `app/(walker)/active-walk.tsx` | GPS tracking during walk |
| Earnings | `app/(walker)/earnings.tsx` | Earnings history, payouts |
| Reviews | `app/(walker)/reviews.tsx` | View ratings and reviews |
| Profile | `app/(walker)/profile.tsx` | Settings, stats |

### State Management
- **Zustand** (`stores/appStore.ts`) - UI/navigation state, auth flow control
- **Convex** - All server data via real-time queries
- **Auth-aware hooks** (`lib/useAuthQuery.ts`) - `useAuthQuery`, `useAuthMutation`, `useAuthAction` wrappers that skip queries when not logged in. All screens use these instead of direct Convex hooks.

### Design System
Theme tokens in `constants/theme.ts`:
- Colors: `colors.ember` (owner), `colors.sage` (walker/impact), `colors.ink` (text)
- Spacing, typography, shadows, radius constants

---

## Backend (Convex)

### Key Files
```
convex/
├── schema.ts          # Database schema
├── me.ts              # Profile queries (getProfile, getImpact, updateProfile)
├── users.ts           # User management, bootstrap
├── dogs.ts            # Dog CRUD
├── walkerProfiles.ts  # Walker profiles, search, toggleVisibility
├── walkRequests.ts    # Booking requests
├── walks.ts           # Walk management, GPS tracking
├── payments.ts        # Stripe integration
├── reviews.ts         # Ratings and tips
├── conversations.ts   # Chat threads
├── messages.ts        # Chat messages
└── notifications.ts   # Push/in-app alerts
```

### Impact Calculation
`api.me.getImpact` query:
- Sums `platformFee` from completed walks + `tipPlatformFee` from reviews
- Returns `{ totalDonated, walksCount, totalMinutes, currency }`

---

## Reviews & Tips

**Tip Split (20% Shelter Match):**
- Tips split 80% walker / 20% shelter (matches walk payment split)
- `tipPlatformFee` stored on review, included in impact calculation
- Walker sees their 80% share in earnings

**7-Day Tip Window:**
- Owners can tip within 7 days of walk completion
- After 7 days: tip section hidden, review-only allowed
- Backend validates: `convex/payments.ts` line ~388

**Walker Reviews Screen:** `app/(walker)/reviews.tsx`
- Shows avgRating, reviewCount stats
- Lists all reviews with rating, date, comment, tip amount
- Accessible from walker Profile → "My Reviews"

**Stats Auto-Update:**
- `walkerProfiles.avgRating` and `reviewCount` update on every new review
- Helper: `updateWalkerStats()` in `convex/reviews.ts`

**"Reviewed" Indicator:**
- Walks list shows "Reviewed" instead of "Leave a Review" for reviewed walks
- `walks.listMineOwnerEnriched` returns `hasReview` boolean

---

## Stripe Integration

**Status:** ✅ Fully integrated with Connect

**Payment Flow:**
```
Owner books walk
    ↓
Backend creates PaymentIntent (manual capture)
    ↓
PaymentSheet appears (card/Apple Pay/Google Pay)
    ↓
Card authorized (hold placed, not charged)
    ↓
Walker accepts → Payment captured
    ↓
80% → Walker's bank (via Connect)
20% → Platform (for shelter donations)
```

**Walker Payout Setup:**
```
Walker opens Earnings tab
    ↓
Taps "Set Up Payouts"
    ↓
Stripe Connect Express onboarding (in browser)
    ↓
Webhook updates status → "Ready for payouts"
```

**Test Cards:**
| Card | Result |
|------|--------|
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 0002` | Declined |

**Webhook Endpoint:** `https://earnest-minnow-363.convex.site/stripe/webhook`
- Events: `account.updated`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`

---

## GPS Walk Tracking

**Status:** ✅ Fixed and working

### Architecture
```
Module Load (active-walk.tsx)
    ↓
IIFE initializes expo-location + expo-task-manager
    ↓
TaskManager.defineTask() called at module level (CRITICAL)
    ↓
Walk starts → status = 'in_progress'
    ↓
Background location task already registered
    ↓
Location updates → buffered (threshold: 1) → batched to backend
    ↓
Token refreshed before each batch (handles long walks)
```

### GPS Status Indicator
Active walk screen shows real-time GPS status:
- **Acquiring GPS...** (yellow) - Waiting for first location
- **GPS Active** (green) - Tracking working
- **GPS Weak** (orange) - Low accuracy signal
- **GPS Stopped** (red) - Tracking failed or stopped

### Logging
Debug logs use prefixes for filtering:
- `[GPS-SETUP]` - Task registration and initialization
- `[GPS-BG]` - Background task execution
- `[GPS-FLUSH]` - Batch upload to backend

### Permission Flow
```
Walker Dashboard Loads
    ↓
After 1.5s: Check permission status
    ↓
Undetermined → Alert explaining why location needed → Request
Denied → Alert with "Open Settings" button
Granted → Silent (already good)
    ↓
Start Walk Button Pressed
    ↓
Pre-check permission before starting:
  - Denied → Alert with "Open Settings"
  - Undetermined → Request inline
  - Granted → Proceed to start walk
```

### Key Files
| File | Purpose |
|------|---------|
| `app/(walker)/active-walk.tsx` | GPS tracking, background task, status indicator |
| `app/(walker)/index.tsx` | Dashboard with active walk banner, permission prompt |
| `convex/walks.ts` | Location validation, distance calculation |
| `convex/http.ts` | `/location/batch` endpoint for background uploads |

### Active Walk Recovery
If walker navigates away from active-walk screen during a walk:
- Dashboard shows prominent "WALK IN PROGRESS" banner (ember/orange)
- Banner displays dog names and elapsed time
- "Continue" button navigates back to active-walk screen
- Active-walk screen auto-recovers in_progress walk via `listMineWalker({ status: 'in_progress' })`

### Error Types
| Error | Message | Recovery |
|-------|---------|----------|
| `permission_denied` | "Location permission denied..." | Tap banner → Open Settings |
| `accuracy_low` | "GPS signal too weak..." | Move outdoors |
| `network` | "Network error..." | Auto-retry with backoff |
| `walk_not_active` | "Walk is no longer active" | Stops tracking |

### Configuration (app.json)
- iOS: `UIBackgroundModes: ["location"]`, `NSLocationAlwaysAndWhenInUseUsageDescription`
- Android: `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE_LOCATION`
- expo-location plugin: `isAndroidBackgroundLocationEnabled: true`

---

## Build Commands

### Simulator
```bash
eas build --profile development --platform ios
eas build:run --platform ios --latest
```

### Physical Device
```bash
eas build --profile development-device --platform ios
# Scan QR to install
```

### Production
```bash
eas build --profile production --platform ios
```

---

## Pre-Production Checklist

**Code Complete:**
- [x] Stripe SDK integration (PaymentSheet)
- [x] Stripe Connect for walker payouts
- [x] Payment capture on walk accept
- [x] Webhook handling (account.updated, payment events)
- [x] Edit Profile screen
- [x] Impact section (donation tracking)
- [x] All security fixes applied
- [x] Physical device testing setup
- [x] End-to-end payment flow tested
- [x] Custom floating paw navigation (owner + walker)
- [x] Dev scaffolding removed (~850 lines: seed data, devEmail, dev bypasses)
- [x] Walker edit profile fixed (photo upload + name persistence matches owner)
- [x] Bootstrap preserves custom names (OAuth name only used for new users)
- [x] GPS tracking race condition fixed (TaskManager.defineTask at module level)
- [x] Location permission pre-check before starting walk
- [x] Permission recovery flow (Open Settings button when denied)
- [x] Early permission prompt on walker dashboard
- [x] Active walk banner on walker dashboard (return to in-progress walk)
- [x] Review/tip workflow (80/20 shelter match, 7-day window)
- [x] Walker reviews screen with stats
- [x] "Reviewed" indicator on owner walks list
- [x] GPS logging with prefixes for debugging
- [x] GPS status indicator on active walk screen
- [x] Token refresh before each GPS batch (long walk support)
- [x] Distance display on owner Walk Details screen
- [x] Owner walks sorted newest first with limit of 20
- [x] Removed non-functional Call button from owner screens
- [x] Cancel button only for scheduled walks (not in_progress)
- [x] Unified login screen (Living Canvas) replaces separate onboarding
- [x] Walker profile shows real walk count and review count
- [x] Reviews display owner's first name (not initials)

**Environment (Convex Dashboard):**
- [x] `AUTH_APPLE_CLIENT_ID=com.packwalk.app`
- [x] `AUTH_GOOGLE_CLIENT_ID`
- [x] `AUTH_GOOGLE_IOS_CLIENT_ID`
- [x] Switch to production Stripe keys (`sk_test_` → `sk_live_`)
- [x] Register production webhook endpoint in Stripe Dashboard

**App Store Requirements:**
- [x] Privacy Policy at packwalk.ca/privacy
- [x] Capture App Store screenshots (5 screens in `/screenshot`)
- [x] Rebuild iOS with production config
- [x] EAS environment variables configured for production
- [x] TestFlight submitted for external beta review
