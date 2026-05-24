import type { DatabaseMigration } from "../migrations";

export const ciFailureArtifactsMigration: DatabaseMigration = {
  id: "007_ci_failure_artifacts",
  name: "ci failure explanation artifact type",
  sql: `
ALTER TABLE analysis_artifacts
  DROP CONSTRAINT analysis_artifacts_type_check;

ALTER TABLE analysis_artifacts
  ADD CONSTRAINT analysis_artifacts_type_check CHECK (
    artifact_type IN ('diff', 'treesitter', 'semgrep', 'context_pack', 'llm_raw', 'ci_log', 'ci_failure_explanation')
  );
`
};
