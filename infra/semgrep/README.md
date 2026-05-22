# Firmcode Semgrep Rules

Local infrastructure rules live in `config.yml` and are intended to run alongside
Semgrep's managed/default rules in the worker scan.

Run the rule tests locally with:

```bash
npm run semgrep:infra:test
```

The command expects the Semgrep CLI to be installed and runs:

```bash
semgrep scan --test --config infra/semgrep/config.yml infra/semgrep/tests
```

The fixture files include both `ruleid` and `ok` annotations for Terraform,
Kubernetes YAML, Dockerfiles, and GitHub Actions workflows.
