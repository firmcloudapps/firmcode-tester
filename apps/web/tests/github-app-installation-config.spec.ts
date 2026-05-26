import { loadGitHubAppInstallConfig } from "../config/github-app-installation";

describe("GitHub App installation config", () => {
  it("uses an explicit GitHub App install URL when configured", () => {
    expect(
      loadGitHubAppInstallConfig({
        GITHUB_APP_INSTALL_URL: "https://github.com/apps/firmcode/installations/new"
      })
    ).toEqual({
      status: "configured",
      installUrl: "https://github.com/apps/firmcode/installations/new",
      source: "GITHUB_APP_INSTALL_URL"
    });
  });

  it("normalizes a bare GitHub App URL to the installation URL", () => {
    expect(
      loadGitHubAppInstallConfig({
        GITHUB_APP_INSTALL_URL: "https://github.com/apps/firmcode"
      })
    ).toEqual({
      status: "configured",
      installUrl: "https://github.com/apps/firmcode/installations/new",
      source: "GITHUB_APP_INSTALL_URL"
    });
  });

  it("accepts a slug accidentally provided in the install URL variable", () => {
    expect(
      loadGitHubAppInstallConfig({
        GITHUB_APP_INSTALL_URL: "firmcodeai"
      })
    ).toEqual({
      status: "configured",
      installUrl: "https://github.com/apps/firmcodeai/installations/new",
      source: "GITHUB_APP_SLUG"
    });
  });

  it("derives the install URL from a GitHub App slug", () => {
    expect(
      loadGitHubAppInstallConfig({
        GITHUB_APP_SLUG: "firmcode-ai"
      })
    ).toEqual({
      status: "configured",
      installUrl: "https://github.com/apps/firmcode-ai/installations/new",
      source: "GITHUB_APP_SLUG"
    });
  });

  it("reports missing public install configuration without secret values", () => {
    expect(loadGitHubAppInstallConfig({})).toEqual({
      status: "missing",
      required: ["GITHUB_APP_INSTALL_URL", "GITHUB_APP_SLUG"]
    });
  });

  it("rejects a relative install URL", () => {
    expect(
      loadGitHubAppInstallConfig({
        GITHUB_APP_INSTALL_URL: "/github/apps/firmcode/install"
      })
    ).toEqual({
      status: "invalid",
      variable: "GITHUB_APP_INSTALL_URL",
      message: "must be an absolute GitHub App installation URL"
    });
  });

  it("falls back to the GitHub App slug when the install URL is malformed", () => {
    expect(
      loadGitHubAppInstallConfig({
        GITHUB_APP_INSTALL_URL: "https://example.com/apps/firmcode/installations/new",
        GITHUB_APP_SLUG: "firmcodeai"
      })
    ).toEqual({
      status: "configured",
      installUrl: "https://github.com/apps/firmcodeai/installations/new",
      source: "GITHUB_APP_SLUG"
    });
  });

  it("rejects a non-GitHub install URL without echoing secret config", () => {
    expect(
      loadGitHubAppInstallConfig({
        GITHUB_APP_INSTALL_URL: "https://example.com/apps/firmcode/installations/new"
      })
    ).toEqual({
      status: "invalid",
      variable: "GITHUB_APP_INSTALL_URL",
      message: "must point to https://github.com/apps/<slug>/installations/new"
    });
  });

  it("rejects non-HTTPS GitHub install URLs", () => {
    expect(
      loadGitHubAppInstallConfig({
        GITHUB_APP_INSTALL_URL: "http://github.com/apps/firmcode/installations/new"
      })
    ).toEqual({
      status: "invalid",
      variable: "GITHUB_APP_INSTALL_URL",
      message: "must be an absolute HTTPS GitHub App installation URL"
    });
  });
});
