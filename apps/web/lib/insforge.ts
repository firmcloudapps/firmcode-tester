import { createBrowserClient } from "@insforge/sdk/ssr";
import type { InsForgeClient } from "@insforge/sdk";
import { loadWebInsForgeAuthRenderConfig } from "../config/insforge";

const { baseUrl, anonKey } = loadWebInsForgeAuthRenderConfig();
const browserAnonKey = anonKey || (typeof window === "undefined" ? "server-render-placeholder-anon-key" : "");

export const insforge: InsForgeClient = createBrowserClient({
  baseUrl,
  anonKey: browserAnonKey
});
