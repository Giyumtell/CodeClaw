# CodeClaw Scrum Board + Per-Role Agent Config

## Part 1: Markdown Scrum Board

### Location
`.codeclaw/board.md` inside each project repo.

### Format

```markdown
# CodeClaw Board — {project name}

## Backlog
- [ ] #1 — {title} | BA | — | {description}

## In Progress
- [ ] #2 — {title} | Developer | @developer | {description}

## In Review
- [x] #3 — {title} | Reviewer | @reviewer | {description}

## Done
- [x] #4 — {title} | — | — | {description}

## Blocked
- [ ] #5 — {title} | Developer | @developer | blocker: {reason}
```

### Task Record Format
Each task line: `- [x|_] #{id} — {title} | {assigned_role} | {agent_id} | {notes}`

### Board Operations
Role agents read/write the board:
- **Team Lead** creates tasks, moves to Backlog, assigns roles
- **Business Analyst** adds acceptance criteria to task notes
- **Developer** moves task to In Progress, then to In Review when done
- **Tester** moves to In Review or back to In Progress if failing
- **Reviewer** moves to Done or back to In Progress with comments
- **Project Manager** reads board for status reports, flags Blocked items

### Board State File
`.codeclaw/board-state.json` — machine-readable companion:
```json
{
  "projectName": "CodeClaw",
  "tasks": [
    {
      "id": 1,
      "title": "Add role system",
      "status": "in-progress",
      "assignedRole": "developer",
      "agentId": "codeclaw-developer",
      "acceptanceCriteria": ["tests pass", "role prompts generated"],
      "blockers": [],
      "createdAt": "2026-03-22T20:00:00Z",
      "updatedAt": "2026-03-22T20:15:00Z"
    }
  ],
  "nextTaskId": 2
}
```

Both files kept in sync — board.md is human-readable, board-state.json is machine-readable.

### Implementation
- `src/agents/codeclaw-board/types.ts` — task, board, status types
- `src/agents/codeclaw-board/board-io.ts` — read/write board.md + board-state.json
- `src/agents/codeclaw-board/board-ops.ts` — createTask, moveTask, assignTask, addBlocker, getStatus
- `src/agents/codeclaw-board/board-format.ts` — render board.md from state
- CLI: `openclaw codeclaw board` — show board, `openclaw codeclaw board add "title"` — quick add

---

## Part 2: Per-Role Agent Configuration

### Concept
Each CodeClaw role maps to an OpenClaw agent entry. Users configure model, identity, workspace per role via the Agents tab in the control UI.

### Agent IDs (convention)
- `codeclaw-team-lead`
- `codeclaw-project-manager`
- `codeclaw-business-analyst`
- `codeclaw-developer`
- `codeclaw-tester`
- `codeclaw-reviewer`

### Config Structure
Each role agent gets registered in `agents.list` with:
```yaml
agents:
  list:
    - id: codeclaw-team-lead
      name: "CodeClaw Team Lead"
      model: anthropic/claude-opus-4
      agentDir: ~/.codeclaw/agents/team-lead    # SOUL.md, MEMORY.md per role
      workspace: ~/clawd/projects/CodeClaw
      tools:
        policy: allowlist
        allow: [read, web_search, memory_search, memory_get]

    - id: codeclaw-developer
      name: "CodeClaw Developer"
      model: github-copilot/gpt-5.3-codex
      agentDir: ~/.codeclaw/agents/developer
      workspace: ~/clawd/projects/CodeClaw
      tools:
        policy: allowlist
        allow: [read, write, edit, exec, web_search]

    - id: codeclaw-tester
      name: "CodeClaw Tester"
      model: google/gemini-2.5-pro
      agentDir: ~/.codeclaw/agents/tester
      workspace: ~/clawd/projects/CodeClaw
      tools:
        policy: allowlist
        allow: [read, write, edit, exec]

    - id: codeclaw-reviewer
      name: "CodeClaw Reviewer"
      model: anthropic/claude-opus-4
      agentDir: ~/.codeclaw/agents/reviewer
      workspace: ~/clawd/projects/CodeClaw
      tools:
        policy: allowlist
        allow: [read, exec]
```

### Per-Role Agent Directories
Each role agent gets its own persistent identity:
```
~/.codeclaw/agents/
  team-lead/
    SOUL.md       # "You are the Team Lead. You decompose, delegate, review."
    MEMORY.md     # Learns project patterns, team velocity, past decisions
  developer/
    SOUL.md       # "You are the Developer. You implement within scope."
    MEMORY.md     # Remembers codebase patterns, past bugs, style preferences
  tester/
    SOUL.md
    MEMORY.md
  reviewer/
    SOUL.md
    MEMORY.md
  project-manager/
    SOUL.md
    MEMORY.md
  business-analyst/
    SOUL.md
    MEMORY.md
```

### How Spawn Uses This
When CodeClaw spawns a role agent:
1. Look up `codeclaw-{role}` in `agents.list`
2. Use that agent's model, tools, workspace config
3. Inject role prompt from `buildRolePrompt()` as system prompt addition
4. Agent wakes up, reads its own SOUL.md and MEMORY.md
5. Agent reads `.codeclaw/board.md` to see current board state
6. Executes its task within role constraints

### Auto-Registration
`openclaw codeclaw init` should:
1. Create `.codeclaw/` in the project
2. Create `board.md` + `board-state.json`
3. Create `~/.codeclaw/agents/{role}/SOUL.md` for each role (with role-specific soul)
4. Register agents in config (or prompt user to configure models via UI)

### Model Selection Rationale
Different models excel at different roles:
- **Team Lead / Reviewer**: Need strong reasoning → Claude Opus, o3
- **Developer**: Need fast code generation → Codex, Claude Sonnet
- **Tester**: Need methodical coverage → Gemini Pro, Claude Sonnet
- **BA / PM**: Need clear communication → any strong model
- Users choose based on their budget and model access

---

## Implementation Plan

### Step 1 — Board types + IO
- Board types, read/write, format/parse board.md
- Tests for round-trip (write → read → compare)

### Step 2 — Board operations
- createTask, moveTask, assignTask, addBlocker
- Board operations update both .md and .json
- Tests

### Step 3 — Board CLI
- `openclaw codeclaw board` commands
- Integrate with existing codeclaw CLI registration

### Step 4 — Agent registration helpers
- `registerCodeClawAgents()` — creates agent entries from role definitions
- `resolveRoleAgent(role)` — looks up agent config for a role
- Default SOUL.md templates per role

### Step 5 — Spawn integration
- Update spawn path to resolve role → agent config
- Agent spawns with its model, tools, workspace, and reads its own soul/memory

### Step 6 — Init command
- `openclaw codeclaw init <repo>` — bootstrap everything
