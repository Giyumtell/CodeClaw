import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { formatBoardMarkdown } from "./board-format.js";
import type { CodeClawBoard } from "./types.js";

function getBoardDir(repoRoot: string): string {
  return path.join(repoRoot, ".codeclaw");
}

function getBoardStatePath(repoRoot: string): string {
  return path.join(getBoardDir(repoRoot), "board-state.json");
}

function getBoardMarkdownPath(repoRoot: string): string {
  return path.join(getBoardDir(repoRoot), "board.md");
}

export async function readBoard(repoRoot: string): Promise<CodeClawBoard | null> {
  const boardStatePath = getBoardStatePath(repoRoot);

  try {
    const raw = await readFile(boardStatePath, "utf8");
    return JSON.parse(raw) as CodeClawBoard;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function writeBoard(board: CodeClawBoard): Promise<void> {
  const boardDir = getBoardDir(board.repoRoot);
  const boardStatePath = getBoardStatePath(board.repoRoot);
  const boardMarkdownPath = getBoardMarkdownPath(board.repoRoot);

  await mkdir(boardDir, { recursive: true });

  await writeFile(boardStatePath, `${JSON.stringify(board, null, 2)}\n`, "utf8");
  await writeFile(boardMarkdownPath, formatBoardMarkdown(board), "utf8");
}

export async function initBoard(repoRoot: string, projectName: string): Promise<CodeClawBoard> {
  const board: CodeClawBoard = {
    projectName,
    repoRoot,
    tasks: [],
    nextTaskId: 1,
  };

  await writeBoard(board);

  return board;
}
