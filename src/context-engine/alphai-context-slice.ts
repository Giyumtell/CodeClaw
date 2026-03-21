import { readFile } from "node:fs/promises";
import path from "node:path";
import { discoverAlphaIotaArtifacts } from "./alphai-artifacts.js";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "build",
  "by",
  "do",
  "for",
  "from",
  "get",
  "help",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "me",
  "my",
  "of",
  "on",
  "or",
  "please",
  "repo",
  "show",
  "task",
  "that",
  "the",
  "this",
  "to",
  "up",
  "use",
  "want",
  "we",
  "with",
  "work",
  "you",
]);

export type AlphaIotaContextSlice = {
  repoRoot: string;
  contextFile: string;
  prompt: string;
  matchedPaths: string[];
  excerpt: string;
  systemPromptAddition: string;
};

function unique<T>(values: Iterable<T>): T[] {
  return [...new Set(values)];
}

function extractKeywords(prompt: string): string[] {
  const words = prompt
    .toLowerCase()
    .match(/[a-z0-9_./-]+/g)
    ?.map((word) => word.trim())
    .filter((word) => word.length >= 3)
    .filter((word) => !STOP_WORDS.has(word));
  return unique(words ?? []).slice(0, 24);
}

function scoreLine(line: string, keywords: string[]): number {
  const lower = line.toLowerCase();
  let score = 0;
  for (const keyword of keywords) {
    if (lower.includes(keyword)) {
      score += keyword.includes("/") || keyword.includes(".") ? 4 : 2;
    }
  }
  if (/^[ ]{2,}[^\s].* — /.test(line)) {
    score += 1;
  }
  return score;
}

function extractMatchedPath(line: string): string | undefined {
  const match = line.match(/^\s*([^\s].*?)\s+—\s+/);
  return match?.[1]?.trim();
}

function mergeRanges(ranges: Array<{ start: number; end: number }>): Array<{ start: number; end: number }> {
  if (ranges.length === 0) {
    return [];
  }
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [sorted[0]];
  for (const range of sorted.slice(1)) {
    const last = merged[merged.length - 1];
    if (range.start <= last.end + 1) {
      last.end = Math.max(last.end, range.end);
      continue;
    }
    merged.push({ ...range });
  }
  return merged;
}

function buildExcerpt(params: {
  lines: string[];
  keywordHits: number[];
  maxChars: number;
  overviewLineCount?: number;
}): { excerpt: string; matchedPaths: string[] } {
  const { lines, keywordHits, maxChars } = params;
  const overview = lines.slice(0, Math.min(params.overviewLineCount ?? 48, lines.length));
  const ranges = mergeRanges(
    keywordHits.map((index) => ({
      start: Math.max(0, index - 3),
      end: Math.min(lines.length - 1, index + 5),
    })),
  );

  const matchedPaths = unique(
    keywordHits
      .map((index) => extractMatchedPath(lines[index]))
      .filter((value): value is string => Boolean(value)),
  ).slice(0, 12);

  const sections: string[] = [];
  if (overview.length > 0) {
    sections.push(overview.join("\n"));
  }
  for (const range of ranges.slice(0, 12)) {
    const block = lines.slice(range.start, range.end + 1).join("\n").trim();
    if (block) {
      sections.push(block);
    }
  }

  let excerpt = unique(sections).join("\n\n---\n\n").trim();
  if (excerpt.length > maxChars) {
    const suffix = "\n\n[truncated...]";
    excerpt = `${excerpt.slice(0, Math.max(0, maxChars - suffix.length)).trimEnd()}${suffix}`;
  }
  return { excerpt, matchedPaths };
}

export async function selectAlphaIotaContextSlice(params: {
  repoRoot: string;
  prompt: string;
  maxChars?: number;
}): Promise<AlphaIotaContextSlice | null> {
  const artifacts = await discoverAlphaIotaArtifacts(params.repoRoot);
  if (!artifacts) {
    return null;
  }

  const prompt = params.prompt.trim();
  if (!prompt) {
    return null;
  }

  const text = await readFile(artifacts.contextFile, "utf8");
  const lines = text.split(/\r?\n/);
  const keywords = extractKeywords(prompt);
  const scored = lines
    .map((line, index) => ({ index, score: scoreLine(line, keywords), line }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const keywordHits = unique(scored.slice(0, 24).map((entry) => entry.index)).sort((a, b) => a - b);
  const { excerpt, matchedPaths } = buildExcerpt({
    lines,
    keywordHits,
    maxChars: params.maxChars ?? 8000,
  });

  if (!excerpt) {
    return null;
  }

  const repoName = path.basename(artifacts.repoRoot);
  const matchedPathText =
    matchedPaths.length > 0 ? matchedPaths.map((value) => `- ${value}`).join("\n") : "- no strong path matches";
  const systemPromptAddition = [
    `AlphaIota repo context is available for workspace ${repoName}.`,
    `Use this as an architecture/navigation hint, not as a substitute for reading the real source before edits.`,
    `Prompt focus: ${prompt}`,
    "Likely relevant paths:",
    matchedPathText,
    "Relevant AlphaIota context excerpt:",
    excerpt,
  ].join("\n\n");

  return {
    repoRoot: artifacts.repoRoot,
    contextFile: artifacts.contextFile,
    prompt,
    matchedPaths,
    excerpt,
    systemPromptAddition,
  };
}
