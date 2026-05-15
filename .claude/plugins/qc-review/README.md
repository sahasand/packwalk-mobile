# QC Review Plugin

Packwalk-specific code review skills for quality control.

## Skills

| Skill | Trigger Phrases |
|-------|-----------------|
| stripe-review | "review stripe", "check payment", "webhook review" |
| convex-review | "review convex", "check mutation", "backend review" |
| react-native-review | "review component", "check screen", "RN review" |
| security-review | "security review", "check auth", "OWASP check" |
| performance-review | "performance review", "check re-renders", "optimize" |
| typescript-review | "typescript review", "check types", "type safety" |

## Commands

### /qc

Run comprehensive code review using all skills.

```
/qc                    # Review current context
/qc path/to/file.tsx   # Review specific file
```

## Usage

Ask Claude to review code and the appropriate skill loads automatically:

```
"Review this Stripe webhook handler"
"Check this Convex mutation for issues"
"QC this component for performance"
```

Or run `/qc` for a full review.
