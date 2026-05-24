# Task 9.6b: Rules And Policies API

```text
Read AGENTS.md first and follow it strictly.
Relevant planning docs: docs/TASKS.md Task 9.6, docs/TASK_PROMPTS.md Task 9.6, docs/PRD.md, docs/AUTHORIZATION.md, docs/LARGE_PR_HANDLING.md, docs/LLM_STRATEGY.md, docs/PRIVACY_RETENTION.md.
Code context requirement: Before implementing, inspect existing repository configuration services, policy/config DTOs, authorization helpers, database schema, settings APIs, validation patterns, and tests.

Implement Rules / Policies API support for workspace and repository review policies. Include review preferences, severity thresholds, max inline comments, category enablement, prompt instructions, ignored paths, generated-file ignore patterns, Semgrep toggles, Tree-sitter/LLM/CI explanation toggles, and infrastructure/security policy sections where already modeled.

Mutations must require Owner/Admin unless docs/AUTHORIZATION.md explicitly allows another role. Validate inputs at trust boundaries, preserve existing values on partial updates, and avoid storing secrets in custom instructions or logs.

Testing requirements:
- Add API tests for policy read, policy update, validation failures, partial update preservation, Owner/Admin success, Developer/Viewer denial, and cross-workspace denial.
- Add tests for ignored-path and prompt-instruction length/format validation.
- Add tests proving sensitive values are not logged or returned unexpectedly.

Acceptance criteria:
- Rules/policy APIs are implemented with typed validation.
- Mutations are role-gated and ownership-gated.
- Policy updates preserve unrelated fields.
- Tests pass through the documented local command, or inability to run them is documented with exact command and failure.
```
