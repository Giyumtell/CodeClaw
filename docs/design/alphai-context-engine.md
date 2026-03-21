# AlphaIota Integration via Context Engine

## Why this seam

CodeClaw already has a pluggable context-engine surface in `src/context-engine/`.
That is the cleanest insertion point for AlphaIota-backed repo awareness.

OpenClaw's existing context engine is about **conversation context management**.
CodeClaw needs to extend that idea so a run can also carry **repo architecture context**.

The right move is not to jam AlphaIota logic into random spawn paths.
The right move is to define a repo-aware context layer that can feed the agent before the task begins.

---

## Problem

Today, the context-engine contract mainly knows about:

- session ids
- messages
- token budgets
- transcript compaction

It does **not** have a first-class concept of:

- assigned repo/workspace
- AlphaIota artifact locations
- relevant file/class selection for a coding task
- architecture summaries as model context

That means CodeClaw currently lacks a canonical place to say:

> This agent is working on repo X, on task Y, with these relevant code areas.

---

## Desired Outcome

A CodeClaw task run should be able to assemble model context from three layers:

1. **conversation context**
   - the user request
   - recent discussion
   - task history
2. **project/task context**
   - repo assignment
   - acceptance criteria
   - current milestone
3. **AlphaIota repo context**
   - repo summary
   - relevant subtree summaries
   - targeted file/class signatures

The result should still fit inside a sane token budget.

---

## MVP Design

## A. Repo assignment state

Introduce explicit repo assignment state for build-oriented runs.

Minimum required fields:

- `repoRoot`
- `alphaiDir` (usually `${repoRoot}/.alphai`)
- `contextFile` (usually `${alphaiDir}/context.txt`)
- optional `workspaceName`
- optional `taskId`

This state can initially live outside the context-engine implementation, but must be available at context assembly time.

## B. AlphaIota artifact discovery

Create a helper that:

- verifies a repo has AlphaIota artifacts
- finds `.alphai/context.txt`
- optionally finds AlphaIota DB/config
- returns a normalized descriptor

Example shape:

```ts
export type AlphaIotaArtifacts = {
  repoRoot: string;
  alphaiDir: string;
  contextFile: string;
  dbFile?: string;
  configFile?: string;
};
```

## C. Context selection helper

Given:

- task prompt
- optional acceptance criteria
- AlphaIota context file

produce:

- repo summary
- likely relevant paths
- compact excerpt or slice for the task

This can start simple:

- keyword/path matching over `context.txt`
- later upgrade to DB-backed retrieval and semantic search

## D. Assembly integration

There are two viable paths:

### Option 1 — extend `ContextEngine.assemble`

Add repo/task/runtime metadata so a context engine can build a richer result.

Pros:

- architecturally clean
- one canonical assembly path

Cons:

- broader plumbing change
- touches existing runtime call sites

### Option 2 — pre-assemble augmentation before `assemble`

Build repo context in the caller and pass it into the runtime as system prompt addition or prebuilt messages.

Pros:

- smaller first step
- lower risk

Cons:

- slightly less pure
- easier to accumulate glue code

### Recommendation

Start with **Option 2** for MVP speed, while designing toward Option 1 once the flow proves out.

---

## Proposed Implementation Sequence

### Step 1

Add a small module, likely near `src/context-engine/` or a new `src/codeclaw/` subtree, for:

- repo assignment types
- AlphaIota artifact discovery

### Step 2

Add a context-selection helper that reads `context.txt` and returns a task-focused excerpt.

### Step 3

Wire that helper into one coding-agent spawn path so the agent gets:

- repo summary
- relevant paths
- task-focused context excerpt
- instructions to read source only where needed

### Step 4

Measure usefulness on a real repo task.

### Step 5

Only then decide whether to promote this into a fully repo-aware context-engine contract.

---

## Non-Goals for the first pass

- full semantic retrieval stack inside CodeClaw
- replacing AlphaIota's own indexing
- giant database migrations
- generalized project management schema

---

## MVP Success Criteria

The MVP is successful if all of this is true:

- CodeClaw can point at a repo with AlphaIota artifacts
- CodeClaw can extract a useful task-focused context slice
- A coding agent launched by CodeClaw uses that slice to navigate faster
- The implementation is small enough to iterate without destabilizing OpenClaw core behavior

---

## First Coding Target

Build these first:

1. `AlphaIotaArtifacts` type
2. `discoverAlphaIotaArtifacts(repoRoot)` helper
3. `selectAlphaIotaContextSlice({ prompt, contextFile })` helper
4. one integration point that attaches the slice to a coding-agent task

That is the first real step from OpenClaw → CodeClaw.
