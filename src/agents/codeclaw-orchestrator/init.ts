import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ensureRoleAgentDirs } from "../codeclaw-agents/agent-setup.js";
import { getDefaultCodeClawAgentConfigs } from "../codeclaw-agents/types.js";
import { initBoard } from "../codeclaw-board/board-io.js";
import {
  createPersistentSessionsState,
  writePersistentSessions,
} from "./persistent-sessions.js";

function resolveDefaultAgentBaseDir(): string {
  return path.join(os.homedir(), ".codeclaw", "agents");
}

export async function initCodeClawProject(params: {
  repoRoot: string;
  projectName: string;
  agentBaseDir?: string;
}): Promise<{ boardPath: string; orchestratorPath: string; agentDirs: string[] }> {
  const repoRoot = path.resolve(params.repoRoot);
  const codeClawDir = path.join(repoRoot, ".codeclaw");
  const agentBaseDir = params.agentBaseDir ?? resolveDefaultAgentBaseDir();

  await mkdir(codeClawDir, { recursive: true });
  await initBoard(repoRoot, params.projectName);
  await ensureRoleAgentDirs(agentBaseDir);
  await writePersistentSessions(
    repoRoot,
    createPersistentSessionsState(params.projectName, repoRoot),
  );

  return {
    boardPath: path.join(codeClawDir, "board.md"),
    orchestratorPath: path.join(codeClawDir, "orchestrator-state.json"),
    agentDirs: getDefaultCodeClawAgentConfigs(agentBaseDir).map((config) => config.agentDir),
  };
}
