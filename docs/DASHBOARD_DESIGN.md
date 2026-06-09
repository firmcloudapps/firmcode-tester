# Dashboard Design

Firmcode's dashboard should feel like a clean, modern, light-mode code review SaaS product: calm, precise, fast to scan, and built for repeated engineering workflows. It should feel closer to a polished developer operations console than a marketing site.

Firmcode is a CodeRabbit-style SaaS product. The dashboard must serve real SaaS customers with a developer-first workflow: account setup, required GitHub OAuth, GitHub App installation, repository automation, report analysis, billing, and tenant-safe operational views are part of the product, not optional admin extras.

Copy-ready prompts for implementing and QAing the dashboard live in `docs/DASHBOARD_PROMPTS.md`.

## Technology Direction

- Framework: Next.js with TypeScript.
- Styling: Tailwind CSS.
- Authentication: InsForge.
- Billing: InsForge Billing.
- Database: NeonDB PostgreSQL.
- UI posture: developer dashboard first, responsive, dense but breathable.

## Visual Direction

### Product Feel

- Quiet, professional, and modern.
- Dense enough for engineering users.
- Clear hierarchy without decorative noise.
- Tables, tabs, drawers, status pills, compact cards, code snippets, and pipeline views.
- No landing-page hero treatment inside the app.
- No oversized decorative cards or one-note color themes.

### Palette

Use a neutral shell with restrained accent color. The dashboard remains light-mode for the MVP, including the PR Review workspace. Reference screenshots can inform spacing, hierarchy, and status treatment, but not a dark-mode treatment.

- App background: `#F8FAFC`
- Surface: `#FFFFFF`
- Subtle surface: `#F1F5F9`
- Border: `#E2E8F0`
- Text primary: `#0F172A`
- Text secondary: `#64748B`
- Accent: `#2563EB` or `#4F46E5`
- Success: `#16A34A`
- Warning: `#D97706`
- Critical: `#DC2626`
- Info: `#0284C7`

### Typography

- Use a clean sans-serif for UI text.
- Use a monospace font for code snippets, commit SHAs, file paths, logs, rule IDs, and environment values.
- Keep headings compact inside dashboards. Avoid hero-scale typography in operational views.

### Component Style

- 6-8px border radius for cards, tables, controls, and drawers.
- Subtle borders over heavy shadows.
- Status pills should use pale backgrounds and strong text colors.
- Tables should have sticky headers where useful.
- Code and logs should appear in bordered monospace panels.
- Diff snippets should highlight added, removed, and context lines with restrained colors.
- Use icons in navigation and action buttons where they improve recognition.

## Global App Shell

```text
Top Bar
├── Workspace switcher
├── Global search
├── GitHub install/connect action
├── Notifications
└── InsForge user menu

Left Sidebar
├── Review
│   ├── Overview
│   ├── PR Review
│   ├── Repositories
│   ├── Pull Requests
│   ├── Review Runs
│   ├── Findings
│   └── CI Failures
└── Account
    ├── Billing
    └── Settings
```

### Top Bar

- Shows current workspace or organization.
- Provides global search across repositories, PRs, findings, and review runs.
- Includes GitHub App install/connect CTA when no installation exists.
- Uses InsForge user menu for identity and account controls.
- Keeps height compact, around 56-64px.

### Sidebar

- Icon plus label navigation.
- Group links under clear operational sections rather than one long flat list.
- Keep PR Review prominent because it is the main workflow for connecting repos, enabling automation, and running/retrying reviews.
- Show small status indicators only where they communicate live product state, such as GitHub connected, app installed, enabled repository, or failed review.
- Active item has soft accent background and left accent indicator.
- Collapse behavior can be deferred for MVP, but mobile should use a drawer.
- Links for unimplemented pages must be disabled or hidden until route readiness tests prove the destination exists.

### Reference-Informed PR Review Workspace

The PR Review page should learn from developer tools that put setup status and repo automation in one focused workspace, while staying information-light. The attached Planarc reference is useful for layout restraint: a left navigation rail, focused PR Review page, GitHub OAuth/App setup cards, repository rows, enabled toggles, and run controls. Do not copy the brand directly; adapt the structure into Firmcode's light-mode system.

Recommended layout:

```text
Header
├── Title: PR Review
├── Description: Automated pull request review status
└── Refresh / Sync action

Connection Cards
├── GitHub OAuth / account connection status
└── Firmcode GitHub App installation status and Add Repository action

Repository Automation Rows
├── Repository identity and owner/name
├── Review readiness status
├── Enabled switch
├── Last review / last run
├── Configure action
└── Run or retry action
```

Behavior notes:

- GitHub is the only active provider in the MVP. Other providers should appear only as disabled planned states if shown at all.
- Connection cards should separate required user/account OAuth connection from GitHub App installation status.
- Every signed-in Firmcode user must connect GitHub OAuth before using GitHub-backed workflows. Developer-facing pages should avoid surfacing admin-role explanations unless the user is blocked by a permission decision.
- PR reviews, repository sync, and PR publishing must use GitHub App installation tokens, not individual users' OAuth tokens.
- Repository rows should make automation state obvious: Ready, Needs setup, Enabled, Disabled, Last reviewed, Failed, or Running.
- Run/retry controls must respect role capabilities and duplicate-click protection.
- The page should support a manual refresh/sync action, but it must be disabled until the sync API is implemented.

## InsForge Responsibilities

InsForge should own:

- Sign in and sign up.
- Session management.
- User profile menu.
- Organization/workspace switcher if InsForge Organizations are enabled.
- Member management if using InsForge Organizations.
- Billing checkout, subscription management, and customer portal via InsForge Billing.

The Next.js app should wrap the dashboard in a InsForge provider boundary. Until `@insforge/sdk` is installed, the boundary remains a no-op scaffold so the rest of the dashboard can compile while the environment and route contracts are tested.

For the complete MVP, the no-op boundary must be replaced by a real `InsForge SDK auth boundary`, InsForge auth checks, sign-in/sign-up pages, `UserButton`, and `workspace switcher` where enabled. Dashboard pages and route handlers must be inaccessible without a InsForge session. The web app must call the API with a InsForge bearer token; static env-based user/workspace headers are a test-only scaffold and do not satisfy the dashboard authentication requirement.

## Authentication Page Design

The sign-in and sign-up pages are product surfaces, not marketing landing pages. They should use a dedicated unauthenticated shell instead of the dashboard shell.

Recommended layout:

```text
Desktop
├── Left context rail
│   ├── Firmcode wordmark
│   ├── Short product line
│   └── Compact setup/security cues
└── Auth panel
    └── InsForge SignIn or SignUp component

Mobile
└── Stacked auth panel with compact wordmark above it
```

Design requirements:

- Use the same light-mode tokens as the dashboard: `bg-shell`, `bg-surface`, `border`, `text-primary`, `text-secondary`, and `accent`.
- Keep the auth panel constrained to roughly 400-460px wide.
- Use 6-8px radius on custom containers and configure InsForge component appearance to match the dashboard controls.
- Keep copy short and operational: users are signing into a PR review workspace, not reading a sales page.
- Include links between sign-in and sign-up through InsForge's built-in routing.
- Include a safe loading/skeleton state if InsForge is still mounting.
- Show InsForge-managed errors in the panel without custom secret-revealing text.
- Avoid decorative gradient blobs, oversized hero treatment, stock imagery, or a split marketing hero.
- The pages must be responsive, keyboard-accessible, and visually checked at mobile and desktop sizes.

Firmcode should store InsForge-linked metadata:

- `user_id`
- `identity_provider_org_id`
- Internal workspace ID.
- Workspace role and capability metadata needed for app authorization.
- Required GitHub OAuth identity metadata, such as GitHub user ID, login, avatar URL, scopes, and connection timestamp. Do not expose OAuth access tokens.
- GitHub installation mapping.
- Repository review configuration.
- Usage counters or cached billing-related usage metrics where needed.
- Audit events for sensitive account, integration, billing, policy, and artifact actions.

## NeonDB Responsibilities

NeonDB stores application state:

- GitHub installations.
- Repositories.
- Pull requests.
- Review runs.
- Changed files.
- Analysis artifacts.
- Findings.
- Published comments.
- User/workspace settings.
- Repository configuration.
- Usage events and review metrics.

Use NeonDB as the PostgreSQL database behind the schema in `docs/PRD.md`.

## Pages

## 1. Overview

Purpose: show the current health and activity of automated reviews.

### Layout

```text
Metric Row
├── Review Activity
├── Security Findings
├── CI Failures Explained
└── Repositories Monitored

Main Grid
├── Recent Review Runs table
└── Needs Attention panel

Lower Section
└── Review Quality metrics
```

### Metric Cards

Each card includes:

- Current value.
- 7-day change.
- Small trend indicator or sparkline.
- Status color only when meaningful.

### Recent Review Runs Table

Columns:

- Repository.
- PR.
- Status.
- Risk.
- Findings.
- Duration.
- Trigger.
- Last updated.

### Needs Attention Panel

Items:

- Failed review jobs.
- High severity findings.
- PRs with CI failures.
- Repositories not fully configured.

## 2. Repositories

Purpose: connect, inspect, and configure GitHub repositories.

### Layout

```text
Header
├── Title: Repositories
├── Sync GitHub
└── Connect GitHub App

Filters
├── Enabled
├── Disabled
├── Private
├── Public
└── Language

Repository Table
```

### Table Columns

- Repository name.
- Default branch.
- Visibility.
- Review automation status.
- Last PR reviewed.
- Last run status.
- Open findings.
- Actions.

### Row Actions

- Enable or disable reviews.
- Configure.
- View runs.
- Sync.

## 2a. PR Review

Purpose: provide the primary operational workspace for GitHub connection health and repository review automation.

### Layout

```text
Header
├── PR Review
└── Refresh / Sync

Connection Status Grid
├── GitHub account/OAuth connection
└── GitHub App installation

Repository Automation List
```

### Connection Status Cards

Each card includes:

- Integration name.
- Purpose text.
- Status pill: Connected, Installed, Missing, Error, or Setup needed.
- Primary action only when backed by a real route or external URL.

### Repository Automation Rows

Rows include:

- Repository display name and exact `owner/repo`.
- Readiness status.
- Enabled switch or checkbox.
- Last review/run status and timestamp.
- Configure action.
- Run/retry action.
- Settings overflow where needed.

Rows should be compact, full-width, and scannable. Prefer inline status pills and toggles over large nested cards.

### Repository Detail Tabs

```text
Overview | Pull Requests | Findings | Configuration | Activity
```

Configuration controls:

- Auto-review enabled.
- Draft PR behavior.
- Max inline comments.
- Review severity threshold.
- Semgrep enabled.
- Tree-sitter parsing enabled.
- CI failure explanation enabled.
- Infrastructure review enabled.
- Dry-run mode.

## 3. Pull Requests

Purpose: act as an engineering queue for PR review activity.

### Filters

- Repository.
- Status.
- Risk level.
- Review status.
- Author.
- Date range.

### Table Columns

- PR title.
- Repository.
- Author.
- Risk.
- Review status.
- Findings.
- CI status.
- Updated.

### PR Detail Layout

```text
Main
├── PR summary
├── Changed components
├── Risk analysis
├── Review timeline
└── Findings list

Right Panel
├── Metadata
├── Branches
├── Commit SHA
├── Files changed
├── Review duration
└── GitHub link
```

Tabs:

```text
Summary | Findings | Files | CI Analysis | Artifacts
```

## 4. Review Runs

Purpose: debug and inspect each pipeline execution.

### Review Run List

Filters:

- Repository.
- Status.
- Trigger.
- Date range.
- Risk.

Columns:

- Run ID.
- Repository.
- PR.
- Status.
- Pipeline stage.
- Duration.
- Findings.
- Comments posted.
- Started.

### Review Run Detail

Header:

```text
Review Run #123
Status
Repository / PR / Commit SHA
```

Summary cards:

- Duration.
- Files analyzed.
- Semgrep findings.
- AI findings.
- Inline comments posted.
- Token usage or estimated cost.

Pipeline visualization:

```text
Webhook Received -> Diff Fetched -> Tree-sitter Parsed -> Semgrep Scanned -> LLM Reviewed -> Comments Published
```

Each stage shows:

- Status.
- Duration.
- Error message if failed.
- Artifact link.

Findings section:

- Severity.
- Source: Semgrep, AI, CI, or policy.
- Category.
- File.
- Line.
- Confidence.
- Posted or not posted.
- Reason if not posted.

## 5. Findings

Purpose: provide a code quality and security inbox.

### Filters

- Severity.
- Source.
- Category.
- Repository.
- Status.
- Posted inline.
- Date.

### Finding Detail Drawer

- Title.
- Explanation.
- Evidence.
- File path and line.
- Semgrep rule ID if available.
- Suggested fix.
- Review run link.
- GitHub comment link.

### Finding Statuses

- Open.
- Posted.
- Suppressed.
- Resolved.
- False positive.

## 6. CI Failures

Purpose: explain broken checks and workflow failures.

### List Columns

- Repository.
- PR.
- Failed workflow/job.
- Root cause summary.
- Flaky suspected.
- Suggested fix.
- Created at.

### Detail View

- Failure summary.
- Likely root cause.
- Suggested fixes.
- Failed jobs.
- Relevant log excerpts.

Raw logs should be collapsed by default and redacted before display.

## 7. Review Preferences

Purpose: control review behavior without adding a first-level Rules / Policies menu item.

Place these controls inside Settings or repository configuration when they are needed:

- Review preferences.
- Security rules.
- Infrastructure rules.
- Comment policy.
- Prompt instructions.
- Ignored paths.

Controls:

- Severity threshold.
- Max comments per PR.
- Enable/disable categories.
- Custom review instructions.
- Paths to ignore.
- Generated file ignore patterns.
- Semgrep rule config.

## 8. Settings

Purpose: workspace and integration settings.

Tabs:

```text
General | GitHub App | Members | API Keys | Data Retention | Notifications
```

InsForge owns identity and membership UI where possible. Firmcode owns GitHub installation mapping, retention policy, notifications, and review configuration.

## 9. Billing

Purpose: lightweight billing and usage view backed by InsForge Billing.

Content:

- Current plan.
- Usage this month.
- Review runs.
- AI tokens.
- Repositories monitored.
- Seats.
- Manage subscription button through InsForge.

The manage subscription action should link to `INSFORGE_BILLING_PORTAL_URL`, which is expected to be a InsForge-managed billing portal or account billing entry point. Firmcode should not implement custom checkout or subscription mutation screens for the MVP.

## MVP Page Priority

Build in this order:

1. Overview.
2. PR Review setup and repository automation workspace.
3. Repositories.
4. Review Runs.
5. Review Run Detail.
6. Findings.
7. Settings.

Pull Requests, CI Failures, Billing, and deeper review-preference controls can follow once the core review loop is visible.

## Tailwind Implementation Notes

- Define semantic color tokens in `tailwind.config.ts`.
- Keep shared UI primitives in `apps/web/components/ui`.
- Keep dashboard-specific components in `apps/web/components/dashboard`.
- Use typed component props and shared API DTOs from `packages/shared`.
- Prefer server components for data-heavy pages and client components for filters, drawers, menus, and interactive controls.
- Use accessible table, tabs, dialog/drawer, menu, tooltip, select, checkbox, switch, and segmented control primitives.
- Ensure empty, loading, error, and permission-denied states for every page.

## Frontend Quality Bar

- Text must not overflow buttons, badges, table cells, cards, or drawers.
- Tables should remain usable on laptop widths.
- Mobile can prioritize navigation, summary cards, and detail drawers; dense tables may become stacked lists.
- Every status should be understandable by text, not color alone.
- Run visual checks on the dashboard after significant frontend changes.
