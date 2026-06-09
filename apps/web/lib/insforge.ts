import { createClient } from "@insforge/sdk";
import { loadWebInsForgeAuthRenderConfig } from "../config/insforge";

const { baseUrl, anonKey } = loadWebInsForgeAuthRenderConfig();

export const insforge = createClient({
  baseUrl,
  anonKey
});

export type InsForgeClient = typeof insforge;
