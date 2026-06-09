/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@firmcode/shared"],
  env: {
    NEXT_PUBLIC_AUTH_PROVIDER: process.env.NEXT_PUBLIC_AUTH_PROVIDER ?? "insforge",
    NEXT_PUBLIC_INSFORGE_BASE_URL:
      process.env.NEXT_PUBLIC_INSFORGE_BASE_URL ??
      process.env.NEXT_PUBLIC_INSFORGE_URL ??
      process.env.INSFORGE_BASE_URL ??
      "https://h35yzuga.eu-central.insforge.app",
    NEXT_PUBLIC_INSFORGE_URL:
      process.env.NEXT_PUBLIC_INSFORGE_URL ??
      process.env.NEXT_PUBLIC_INSFORGE_BASE_URL ??
      process.env.INSFORGE_BASE_URL ??
      "https://h35yzuga.eu-central.insforge.app",
    NEXT_PUBLIC_INSFORGE_ANON_KEY:
      process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY ?? process.env.INSFORGE_ANON_KEY ?? ""
  }
};

export default nextConfig;
