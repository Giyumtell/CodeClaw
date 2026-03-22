import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { initRoleMemory } from "../codeclaw-memory/index.js";
import { generateRoleSoul } from "./soul-templates.js";
import { getDefaultCodeClawAgentConfigs } from "./types.js";

async function writeIfMissing(filePath: string, content: string): Promise<void> {
  try {
    await writeFile(filePath, content, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      return;
    }
    throw error;
  }
}

export async function ensureRoleAgentDirs(baseDir: string): Promise<void> {
  await mkdir(baseDir, { recursive: true });

  for (const config of getDefaultCodeClawAgentConfigs(baseDir)) {
    await mkdir(config.agentDir, { recursive: true });

    const soulPath = path.join(config.agentDir, "SOUL.md");
    const learningsPath = path.join(config.agentDir, "LEARNINGS.md");

    await writeIfMissing(soulPath, `${generateRoleSoul(config.role).trimEnd()}\n`);
    await writeIfMissing(
      learningsPath,
      `# Learnings — ${config.role}\n\nThis is your knowledge base. Everything you discover, figure out, or learn goes here.\nRead this on every prompt. Update it whenever you learn something new.\n\n---\n\n*No entries yet.*\n`,
    );
    await initRoleMemory(config.agentDir, config.role);
  }
}
