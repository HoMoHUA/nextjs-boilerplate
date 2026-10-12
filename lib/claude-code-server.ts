import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/** Server-side Claude Code (Agent SDK) settings, read from env. */
export function claudeCodeConfig() {
  return {
    // Claude Code runs tools (files, shell) on this machine: on by default only in local development;
    // production and serverless hosts must opt in with CLAUDE_CODE_ENABLED=true
    enabled: process.env.CLAUDE_CODE_ENABLED
      ? process.env.CLAUDE_CODE_ENABLED === "true"
      : !process.env.VERCEL && process.env.NODE_ENV !== "production",
    cwd: process.env.CLAUDE_CODE_CWD || process.cwd(),
    model: process.env.CLAUDE_CODE_MODEL || undefined,
    permissionMode: (process.env.CLAUDE_CODE_PERMISSION_MODE || "acceptEdits") as
      | "default"
      | "acceptEdits"
      | "bypassPermissions"
      | "plan"
      | "dontAsk"
      | "auto",
    maxTurns: Number(process.env.CLAUDE_CODE_MAX_TURNS || 40),
  };
}

export interface FileSubagent {
  id: string;
  name: string;
  description: string;
  source: "project" | "user";
}

function frontmatter(md: string): Record<string, string> {
  const m = /^---\s*\n([\s\S]*?)\n---/.exec(md);
  const out: Record<string, string> = {};
  if (!m) return out;
  for (const line of m[1].split("\n")) {
    const kv = /^([\w-]+)\s*:\s*(.*)$/.exec(line);
    if (kv) out[kv[1]] = kv[2].replace(/^["']|["']$/g, "").trim();
  }
  return out;
}

/** Lists subagents defined in `.claude/agents/*.md` (project) and `~/.claude/agents/*.md` (user). */
export async function listFileSubagents(cwd: string): Promise<FileSubagent[]> {
  const dirs: [string, FileSubagent["source"]][] = [
    [path.join(cwd, ".claude", "agents"), "project"],
    [path.join(os.homedir(), ".claude", "agents"), "user"],
  ];
  const found = new Map<string, FileSubagent>();
  for (const [dir, source] of dirs) {
    let files: string[] = [];
    try {
      files = (await fs.readdir(dir)).filter((f) => f.endsWith(".md"));
    } catch {
      continue;
    }
    for (const f of files) {
      const fm = frontmatter(await fs.readFile(path.join(dir, f), "utf8").catch(() => ""));
      const id = fm.name || f.replace(/\.md$/, "");
      if (!found.has(id)) found.set(id, { id, name: id, description: fm.description ?? "", source });
    }
  }
  return [...found.values()];
}
