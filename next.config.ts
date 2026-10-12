import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // self-contained server bundle for Docker / bare-metal deploys (see deploy/)
  output: "standalone",
  poweredByHeader: false,
  // The Agent SDK spawns the Claude Code CLI shipped inside its package; keep it unbundled.
  serverExternalPackages: ["@anthropic-ai/claude-agent-sdk"],
};

export default nextConfig;
