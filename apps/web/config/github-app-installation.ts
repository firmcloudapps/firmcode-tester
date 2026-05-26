import type { EnvironmentVariables } from "@firmcode/shared";

export type GitHubAppInstallConfig =
  | {
      status: "configured";
      installUrl: string;
      source: "GITHUB_APP_INSTALL_URL" | "GITHUB_APP_SLUG";
    }
  | {
      status: "missing";
      required: string[];
    }
  | {
      status: "invalid";
      variable: string;
      message: string;
    };

const INSTALL_URL_VARIABLES = ["GITHUB_APP_INSTALL_URL", "NEXT_PUBLIC_GITHUB_APP_INSTALL_URL"] as const;
const SLUG_VARIABLES = ["GITHUB_APP_SLUG", "NEXT_PUBLIC_GITHUB_APP_SLUG"] as const;
const GITHUB_APP_PATH = /^\/apps\/([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)(?:\/installations\/new\/?)?$/i;
const GITHUB_APP_SLUG = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;

export function loadGitHubAppInstallConfig(env: EnvironmentVariables = process.env): GitHubAppInstallConfig {
  const configuredUrl = readFirst(env, INSTALL_URL_VARIABLES);
  const configuredSlug = readFirst(env, SLUG_VARIABLES);

  if (configuredUrl !== null) {
    const installUrlConfig = toInstallUrlConfig(configuredUrl.variable, configuredUrl.value);

    if (installUrlConfig.status === "configured" || configuredSlug === null) {
      return installUrlConfig;
    }
  }

  if (configuredSlug !== null) {
    return toSlugConfig(configuredSlug.variable, configuredSlug.value);
  }

  return {
    status: "missing",
    required: ["GITHUB_APP_INSTALL_URL", "GITHUB_APP_SLUG"]
  };
}

function toInstallUrlConfig(variable: string, value: string): GitHubAppInstallConfig {
  if (GITHUB_APP_SLUG.test(value)) {
    return {
      status: "configured",
      installUrl: buildInstallUrl(value),
      source: "GITHUB_APP_SLUG"
    };
  }

  try {
    const url = new URL(value);

    if (url.protocol !== "https:") {
      return {
        status: "invalid",
        variable,
        message: "must be an absolute HTTPS GitHub App installation URL"
      };
    }

    const match = url.hostname.toLowerCase() === "github.com" ? GITHUB_APP_PATH.exec(url.pathname) : null;

    if (match === null) {
      return {
        status: "invalid",
        variable,
        message: "must point to https://github.com/apps/<slug>/installations/new"
      };
    }

    return {
      status: "configured",
      installUrl: buildInstallUrl(match[1]),
      source: "GITHUB_APP_INSTALL_URL"
    };
  } catch {
    return {
      status: "invalid",
      variable,
      message: "must be an absolute GitHub App installation URL"
    };
  }
}

function toSlugConfig(variable: string, value: string): GitHubAppInstallConfig {
  if (!GITHUB_APP_SLUG.test(value)) {
    return {
      status: "invalid",
      variable,
      message: "must be a GitHub App slug such as firmcode-ai"
    };
  }

  return {
    status: "configured",
    installUrl: buildInstallUrl(value),
    source: "GITHUB_APP_SLUG"
  };
}

function buildInstallUrl(slug: string): string {
  return `https://github.com/apps/${slug}/installations/new`;
}

function readFirst(
  env: EnvironmentVariables,
  variables: readonly string[]
): { variable: string; value: string } | null {
  for (const variable of variables) {
    const value = env[variable]?.trim();

    if (value !== undefined && value !== "") {
      return { variable, value };
    }
  }

  return null;
}
