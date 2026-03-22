import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { OrchestratorState } from "./types.js";

function getOrchestratorStatePath(repoRoot: string): string {
  return path.join(repoRoot, ".codeclaw", "orchestrator-state.json");
}

export async function readOrchestratorState(repoRoot: string): Promise<OrchestratorState | null> {
  const statePath = getOrchestratorStatePath(repoRoot);

  try {
    const raw = await readFile(statePath, "utf8");
    return JSON.parse(raw) as OrchestratorState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function writeOrchestratorState(state: OrchestratorState): Promise<void> {
  const statePath = getOrchestratorStatePath(state.repoRoot);
  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}
