export interface PromptMetadata {
  promptId: string;
  version: string;
  schemaVersion: string;
}

export const REVIEW_PROMPT_METADATA: PromptMetadata = {
  promptId: "firmcode.review.initial",
  version: "0.1.0",
  schemaVersion: "0.1.0"
};
