import { createRefreshAuthRouter } from "@insforge/sdk/ssr";
import { loadWebInsForgeAuthRenderConfig } from "../../../../config/insforge";

export const dynamic = "force-dynamic";

const { baseUrl, anonKey } = loadWebInsForgeAuthRenderConfig();

export const { POST } = createRefreshAuthRouter({
  baseUrl,
  anonKey
});
