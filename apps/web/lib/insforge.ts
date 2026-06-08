import { createClient } from "@insforge/sdk";

const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_BASE_URL || "https://h35yzuga.eu-central.insforge.app";
const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY || process.env.INSFORGE_ANON_KEY || "";

export const insforge = createClient({
  baseUrl,
  anonKey
});

export type InsForgeClient = typeof insforge;
