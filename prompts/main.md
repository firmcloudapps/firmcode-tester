I want you to help me build an AI-powered pull request review and testing platform inspired by CodeRabbit.

The system should combine capabilities from:
- PR-Agent: pr-agent
- Semgrep: semgrep
- Tree-sitter: tree-sitter

The goal is to create a production-ready personal MVP focused on:
- AI pull request reviews
- inline review comments
- security analysis
- semantic code understanding
- CI/CD failure explanations
- AI-generated test suggestions
- infrastructure/devops review

==================================================
CORE PRODUCT REQUIREMENTS
==================================================

Build a platform that can:

1. Connect to GitHub repositories
2. Listen to pull request events using webhooks
4. Extract pull request diffs
5. Parse changed files using Tree-sitter
6. Run Semgrep static analysis scans
7. Send semantic context + diff + Semgrep findings to LLM
8. Generate AI review comments
9. Post inline review comments back to GitHub
10. Generate PR summaries
11. Suggest missing tests
12. Explain CI/CD failures
13. Review infrastructure code:
   - Terraform
   - Kubernetes YAML
   - Dockerfiles
   - GitHub Actions

==================================================
ARCHITECTURE REQUIREMENTS
==================================================

Use modular clean architecture.

Preferred stack:
- Backend: NestJS
- AI workers: Python
- Queue: Redis + BullMQ
- Database: PostgreSQL
- Frontend: Next.js
- Deployment: Docker Compose initially

Architecture flow:

GitHub Webhook
    ↓
NestJS API
    ↓
Queue System
    ↓
AI Review Worker
    ↓
Tree-sitter Parsing
    ↓
Semgrep Analysis
    ↓
LLM Review Engine
    ↓
GitHub PR Comments

==================================================
FEATURE REQUIREMENTS
==================================================

1. GitHub Integration
- GitHub App support
- OAuth support
- Webhook verification
- Pull request event handling
- PR comment posting
- Inline review comments

2. Diff Intelligence
- Extract changed files
- Extract hunks
- Track line numbers
- Detect file types
- Detect risky modifications

3. Tree-sitter Integration
Use Tree-sitter for:
- AST parsing
- semantic analysis
- function extraction
- class extraction
- dependency tracing
- syntax-aware chunking

4. Semgrep Integration
Run Semgrep scans on:
- changed files only
- infrastructure code
- security vulnerabilities
- secrets
- bad practices

The AI must use Semgrep findings as grounding context.

5. AI Review Engine
The AI should:
- detect bugs
- detect performance issues
- detect security vulnerabilities
- detect maintainability issues
- suggest better architecture
- explain code quality concerns
- suggest test cases
- explain risky changes

6. Infrastructure Review
Special focus on:
- Terraform
- Kubernetes YAML
- Helm charts
- Dockerfiles
- GitHub Actions

Review for:
- security
- cost optimization
- best practices
- scalability
- reliability

7. CI/CD Failure Analysis
When CI fails:
- parse logs
- summarize root cause
- suggest fixes
- detect flaky tests

8. PR Summary Generator
Generate:
- executive summary
- changed components
- risk analysis
- testing recommendations

==================================================
AI REQUIREMENTS
==================================================

Use multi-stage AI processing:

Stage 1:
- Tree-sitter semantic parsing

Stage 2:
- Semgrep static analysis

Stage 3:
- Context retrieval

Stage 4:
- LLM review reasoning

Stage 5:
- GitHub review formatting

The AI system must:
- minimize hallucinations
- use deterministic findings from Semgrep
- use AST-aware context from Tree-sitter
- understand repository structure

==================================================
CODE QUALITY REQUIREMENTS
==================================================

Generate:
- scalable architecture
- production-grade code
- clean folder structure
- reusable modules
- typed interfaces
- testable services
- dockerized services
- environment variable support
- logging
- retry handling
- queue retry support
- webhook validation
- rate limiting

==================================================
OUTPUT REQUIREMENTS
==================================================

I want:
1. Full architecture design
2. Folder structure
3. Database schema
4. Service breakdown
5. API design
6. Webhook flow
7. Queue flow
8. AI pipeline design
9. Tree-sitter integration plan
10. Semgrep integration plan
11. GitHub App setup guide
12. Docker Compose setup
13. MVP roadmap
14. Step-by-step implementation phases
15. Example prompts for AI review engine
16. Example PR review outputs
17. Example inline review comments
18. Security considerations
19. Scaling recommendations
20. Cost optimization strategy

==================================================
IMPORTANT IMPLEMENTATION RULES
==================================================

- Prioritize MVP simplicity first
- Avoid premature microservices complexity
- Keep deployment simple initially
- Focus on GitHub integration first
- Use Docker Compose before Kubernetes
- Build modularly for future scaling
- Ensure AI reviews are grounded using Semgrep findings
- Use Tree-sitter for semantic understanding instead of naive chunking
- Design for future multi-repository support
- Optimize for developer experience and fast review times

Now generate:
1. The complete system architecture
2. Recommended folder structure
3. Implementation roadmap
4. Initial MVP modules
5. Step-by-step development plan
6. Sample code scaffolding
7. AI review pipeline design