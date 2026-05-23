export interface GitHubWebhookEventIdentity {
  readonly eventName: string;
  readonly action: string | null;
}

const SUPPORTED_EVENTS = new Set([
  "push",
  "pull_request.opened",
  "pull_request.synchronize",
  "pull_request.reopened",
  "pull_request.ready_for_review",
  "check_run.completed",
  "check_suite.completed",
  "workflow_run.completed",
  "installation.created",
  "installation.deleted",
  "installation_repositories.added",
  "installation_repositories.removed"
]);

export function isSupportedGitHubWebhookEvent({ eventName, action }: GitHubWebhookEventIdentity): boolean {
  if (eventName === "push" && action === null) {
    return SUPPORTED_EVENTS.has("push");
  }

  return action !== null && SUPPORTED_EVENTS.has(`${eventName}.${action}`);
}
