import { access } from "node:fs/promises";
import path from "node:path";

export type AlphaIotaArtifacts = {
  repoRoot: string;
  alphaiDir: string;
  contextFile: string;
  dbFile?: string;
  configFile?: string;
};

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function discoverAlphaIotaArtifacts(
  repoRoot: string,
): Promise<AlphaIotaArtifacts | null> {
  const alphaiDir = path.join(repoRoot, ".alphai");
  const contextFile = path.join(alphaiDir, "context.txt");

  if (!(await pathExists(contextFile))) {
    return null;
  }

  const dbCandidates = ["alphai.db", "tree.db"];
  const configCandidates = ["config.yaml", "config.yml"];

  let dbFile: string | undefined;
  for (const candidate of dbCandidates) {
    const candidatePath = path.join(alphaiDir, candidate);
    if (await pathExists(candidatePath)) {
      dbFile = candidatePath;
      break;
    }
  }

  let configFile: string | undefined;
  for (const candidate of configCandidates) {
    const candidatePath = path.join(alphaiDir, candidate);
    if (await pathExists(candidatePath)) {
      configFile = candidatePath;
      break;
    }
  }

  return {
    repoRoot,
    alphaiDir,
    contextFile,
    ...(dbFile ? { dbFile } : {}),
    ...(configFile ? { configFile } : {}),
  };
}

export async function hasAlphaIotaArtifacts(repoRoot: string): Promise<boolean> {
  return (await discoverAlphaIotaArtifacts(repoRoot)) !== null;
}
