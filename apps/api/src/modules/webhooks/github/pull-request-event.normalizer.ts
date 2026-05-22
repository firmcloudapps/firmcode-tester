import { BadRequestException } from "@nestjs/common";
import type {
  GitHubInstallationUpsert,
  PullRequestUpsert,
  RepositoryUpsert
} from "./github-webhook.store";

export interface NormalizedPullRequestEvent {
  installation: GitHubInstallationUpsert;
  repository: Omit<RepositoryUpsert, "installationId" | "enabled">;
  pullRequest: Omit<PullRequestUpsert, "repositoryId">;
}

type JsonObject = Record<string, unknown>;

export function normalizePullRequestEvent(payload: JsonObject): NormalizedPullRequestEvent {
  const installation = readObject(payload, "installation");
  const repository = readObject(payload, "repository");
  const pullRequest = readObject(payload, "pull_request");
  const fullName = readString(repository, "full_name");
  const [ownerFromName, nameFromFullName] = splitRepositoryFullName(fullName);
  const repositoryOwner = readOptionalObject(repository, "owner");
  const author = readOptionalObject(pullRequest, "user");
  const base = readObject(pullRequest, "base");
  const head = readObject(pullRequest, "head");
  const installationAccount = readOptionalObject(installation, "account");
  const permissions = readOptionalObject(installation, "permissions") ?? {};

  return {
    installation: {
      installationId: readNumber(installation, "id"),
      accountLogin: readOptionalString(installationAccount, "login") ?? readOptionalString(repositoryOwner, "login"),
      accountType: readOptionalString(installationAccount, "type") ?? readOptionalString(repositoryOwner, "type"),
      permissionsJson: permissions
    },
    repository: {
      githubRepositoryId: readNumber(repository, "id"),
      owner: readOptionalString(repositoryOwner, "login") ?? ownerFromName,
      name: readOptionalString(repository, "name") ?? nameFromFullName,
      fullName,
      private: readOptionalBoolean(repository, "private") ?? false,
      defaultBranch: readOptionalString(repository, "default_branch") ?? "main"
    },
    pullRequest: {
      githubPullRequestId: readNumber(pullRequest, "id"),
      number: readNumber(pullRequest, "number"),
      title: readString(pullRequest, "title"),
      authorLogin: readOptionalString(author, "login") ?? "unknown",
      baseRef: readString(base, "ref"),
      headRef: readString(head, "ref"),
      baseSha: readString(base, "sha"),
      headSha: readString(head, "sha"),
      state: readString(pullRequest, "state"),
      draft: readOptionalBoolean(pullRequest, "draft") ?? false
    }
  };
}

export function readPullRequestEventMetadata(payload: JsonObject): {
  installationId: number | null;
  repositoryId: number | null;
  pullRequestNumber: number | null;
  headSha: string | null;
} {
  const installation = readOptionalObject(payload, "installation");
  const repository = readOptionalObject(payload, "repository");
  const pullRequest = readOptionalObject(payload, "pull_request");
  const head = readOptionalObject(pullRequest, "head");

  return {
    installationId: readOptionalNumber(installation, "id"),
    repositoryId: readOptionalNumber(repository, "id"),
    pullRequestNumber: readOptionalNumber(pullRequest, "number"),
    headSha: readOptionalString(head, "sha")
  };
}

function splitRepositoryFullName(value: string): [string, string] {
  const [owner, name] = value.split("/");

  if (!owner || !name) {
    throw new BadRequestException("GitHub pull_request repository.full_name must be owner/name");
  }

  return [owner, name];
}

function readObject(source: JsonObject, key: string): JsonObject {
  const value = source[key];

  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonObject;
  }

  throw new BadRequestException(`GitHub pull_request payload is missing ${key}`);
}

function readOptionalObject(source: JsonObject | null, key: string): JsonObject | null {
  if (source === null) {
    return null;
  }

  const value = source[key];

  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonObject;
  }

  return null;
}

function readString(source: JsonObject, key: string): string {
  const value = source[key];

  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  throw new BadRequestException(`GitHub pull_request payload is missing ${key}`);
}

function readNumber(source: JsonObject, key: string): number {
  const value = source[key];

  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  throw new BadRequestException(`GitHub pull_request payload is missing ${key}`);
}

function readOptionalString(source: JsonObject | null, key: string): string | null {
  if (source === null) {
    return null;
  }

  const value = source[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readOptionalNumber(source: JsonObject | null, key: string): number | null {
  if (source === null) {
    return null;
  }

  const value = source[key];
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function readOptionalBoolean(source: JsonObject, key: string): boolean | null {
  const value = source[key];
  return typeof value === "boolean" ? value : null;
}
