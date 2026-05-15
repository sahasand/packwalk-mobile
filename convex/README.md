# Convex Backend

This repo now includes a Convex backend scaffold aligned with `packwalk-backend-plan-v3.md`.

## Setup
1. Install dependencies: `npm install`
2. Initialize a Convex project for this repo: `npx convex dev --once --configure=new`
3. Run the local backend: `npm run convex:dev`

Convex will generate code in `convex/_generated/` (git‑ignored). Re‑run `npm run convex:codegen` if you need fresh client types.

Required environment variables are listed in `.env.example`. Copy to `.env.local` and fill in real values for local dev; set server‑only values again in the Convex dashboard for staging/prod.

## What’s Implemented (Phase 1)
- Full schema in `convex/schema.ts`
- Auth bootstrap and current‑user query in `convex/users.ts`
- Guard, soft‑delete, and rate‑limit helpers in `convex/lib/*`
- HTTP webhook router scaffolding in `convex/http.ts`

## Next
Phase 2+ modules (dogs, walkerProfiles search, walk lifecycle, Stripe flows) should be added following the v3 plan.
