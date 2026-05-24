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

export function loadGitHubAppInstallConfig(env: EnvironmentVariables = process.env): GitHubAppInstallConfig {
  const configuredUrl = readFirst(env, INSTALL_URL_VARIABLES);

  if (configuredUrl !== null) {
    return toInstallUrlConfig(configuredUrl.variable, configuredUrl.value);
  }

  const configuredSlug = readFirst(env, SLUG_VARIABLES);

  if (configuredSlug !== null) {
    return toSlugConfig(configuredSlug.variable, configuredSlug.value);
  }

  return {
    status: "missing",
    required: ["GITHUB_APP_INSTALL_URL", "GITHUB_APP_SLUG"]
  };
}

function toInstallUrlConfig(variable: string, value: string): GitHubAppInstallConfig {
  try {
    const url = new URL(value);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return {
        status: "invalid",
        variable,
        message: "must be an absolute HTTP or HTTPS URL"
      };
    }

    return {
      status: "configured",
      installUrl: url.toString(),
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
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/i.test(value) && !/^[a-z0-9]$/i.test(value)) {
    return {
      status: "invalid",
      variable,
      message: "must be a GitHub App slug such as firmcode-ai"
    };
  }

  return {
    status: "configured",
    installUrl: `https://github.com/apps/${value}/installations/new`,
    source: "GITHUB_APP_SLUG"
  };
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
