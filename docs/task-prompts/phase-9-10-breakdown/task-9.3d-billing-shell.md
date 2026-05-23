# Task 9.3d: Billing Shell

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 9.3, docs/TASK_PROMPTS.md Task 9.3, docs/DASHBOARD_DESIGN.md, docs/DASHBOARD_PROMPTS.md, docs/AUTHORIZATION.md, docs/ENVIRONMENT.md, docs/DEPLOYMENT.md.
Code context requirement: Before implementing, inspect the existing billing page, Clerk configuration, environment validation, dashboard shell, tests, and any usage summary APIs before changing behavior.

Build or complete the Billing shell. Display plan and usage placeholders or real usage counters where already available: current plan, monthly review runs, AI tokens, repositories, seats, and billing status. Billing subscription management must route to Clerk Billing through the configured portal URL or Clerk-managed component; do not store payment state locally.

Billing access must be Clerk-authenticated and require Owner/Admin or the Clerk-managed billing role described in docs/AUTHORIZATION.md. Lower roles should see a clear denied or read-only state depending on existing route conventions.

Testing requirements:
- Add component tests for billing populated, missing portal URL, and loading/error states if data is fetched.
- Add Clerk-gated and elevated-role access tests.
- Add environment/config validation tests for the billing portal URL if such validation exists in this runtime.
- Add or document a desktop/mobile visual smoke check.

Acceptance criteria:
- Billing displays plan/usage placeholders or available counters.
- Manage Subscription routes to Clerk Billing.
- Billing access is role-gated.
- UI follows docs/DASHBOARD_DESIGN.md and does not introduce local payment management.
- Tests and visual smoke checks pass, or inability to run them is documented with exact commands.
```

