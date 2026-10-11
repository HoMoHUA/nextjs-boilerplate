import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Agent SDK spawns the Claude Code CLI shipped inside its package; keep it unbundled.
  serverExternalPackages: ["@anthropic-ai/claude-agent-sdk"],
};

export default nextConfig;
