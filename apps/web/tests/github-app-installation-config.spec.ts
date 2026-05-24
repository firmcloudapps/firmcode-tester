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
});
