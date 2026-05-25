type SearchParamValue = string | string[] | undefined;

export type GitHubInstallationsNotice =
  | "oauth-connected"
  | "oauth-error"
  | "installation-connected"
  | "installation-error";

export function parseGitHubInstallationsNotice(searchParams: {
  readonly github_oauth?: SearchParamValue;
  readonly github_installation?: SearchParamValue;
}): GitHubInstallationsNotice | null {
  const oauth = readSingleValue(searchParams.github_oauth);

  if (oauth === "connected") {
    return "oauth-connected";
  }

  if (oauth === "error") {
    return "oauth-error";
  }

  const installation = readSingleValue(searchParams.github_installation);

  if (installation === "connected") {
    return "installation-connected";
  }

  if (installation === "error") {
    return "installation-error";
  }

  return null;
}

function readSingleValue(value: SearchParamValue): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}
