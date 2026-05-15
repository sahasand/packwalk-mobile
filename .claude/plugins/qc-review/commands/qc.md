---
description: Run comprehensive Packwalk code review using all QC skills
allowed-tools:
  - Read
  - Glob
  - Grep
argument-hint: "[file-path]"
---

# Comprehensive Packwalk Code Review

Run a full quality control review using all available skills.

## Instructions

1. **Determine scope**:
   - If a file path is provided: `$ARGUMENTS`, review that file
   - If no path: ask user what to review, or review recent changes via git

2. **Read the target code** using Read tool

3. **Apply ALL review skills** in order:

   ### Stripe Review (if payment-related code)
   - Payment intents, webhooks, Connect
   - Idempotency, error handling
   - Security (signatures, no hardcoded keys)

   ### Convex Review (if backend code)
   - Auth guards on all mutations
   - Index usage for queries
   - Error handling with packwalkError()
   - Rate limiting on sensitive operations

   ### React Native Review (if frontend code)
   - useAuthQuery not raw useQuery
   - Loading/empty states
   - Theme tokens from constants/theme.ts
   - useEffect cleanup

   ### Security Review
   - Ownership checks
   - No exposed PII
   - Input validation
   - OWASP considerations

   ### Performance Review
   - useMemo/useCallback usage
   - FlatList for long lists
   - No inline object props
   - Query optimization

   ### TypeScript Review
   - No `any` types
   - Proper null handling
   - Correct Convex types (Id, Doc)
   - Type guards over casting

4. **Report findings** in this format:

   ```
   ## QC Review: [filename]

   ### Critical Issues
   - [ ] Issue description (line X)

   ### Warnings
   - [ ] Warning description (line X)

   ### Suggestions
   - [ ] Suggestion for improvement

   ### Passed Checks
   - [x] Auth guards present
   - [x] Types correct
   ...
   ```

5. **Prioritize issues**:
   - Critical: Security vulnerabilities, data loss risks
   - Warnings: Performance issues, missing validation
   - Suggestions: Style, minor improvements

## Example Usage

```
/qc convex/payments.ts
/qc app/(walker)/active-walk.tsx
/qc                              # Review recent git changes
```
