import { html, nothing } from "lit";
import type {
  CodeClawBoard,
  CodeClawBoardTask,
  CodeClawOrchestratorState,
  CodeClawRole,
  CodeClawRunStep,
  CodeClawTaskStatus,
} from "../types.ts";

const STATUS_COLUMNS: Array<{ key: CodeClawTaskStatus; label: string }> = [
  { key: "backlog", label: "Backlog" },
  { key: "in-progress", label: "In Progress" },
  { key: "in-review", label: "In Review" },
  { key: "done", label: "Done" },
  { key: "blocked", label: "Blocked" },
];

const LIFECYCLE_ORDER: CodeClawRole[] = [
  "business-analyst",
  "team-lead",
  "developer",
  "tester",
  "reviewer",
  "project-manager",
];

export type CodeClawProps = {
  loading: boolean;
  error: string | null;
  board: CodeClawBoard | null;
  orchestratorState: CodeClawOrchestratorState | null;
  runPlan: CodeClawRunStep[] | null;
  nextStep: CodeClawRunStep | null;
  repoRoot: string;
  projectName: string;
  userGoal: string;
  onRepoRootChange: (value: string) => void;
  onProjectNameChange: (value: string) => void;
  onUserGoalChange: (value: string) => void;
  onInitProject: () => void;
  onPlanRun: () => void;
  onRefresh: () => void;
  onExecuteNextStep: () => void;
  onAdvanceTask: (taskId: number, status: CodeClawTaskStatus) => void;
};

function roleLabel(role: CodeClawRole | undefined): string {
  if (!role) {
    return "Unassigned";
  }
  return role
    .split("-")
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function roleColor(role: CodeClawRole | undefined): string {
  switch (role) {
    case "business-analyst":
      return "#1d4ed8";
    case "team-lead":
      return "#4f46e5";
    case "developer":
      return "#0f766e";
    case "tester":
      return "#0369a1";
    case "reviewer":
      return "#b45309";
    case "project-manager":
      return "#be123c";
    default:
      return "#374151";
  }
}

function statusCardTone(status: CodeClawTaskStatus): string {
  if (status === "done") {
    return "border-color: rgba(22, 163, 74, 0.45);";
  }
  if (status === "blocked") {
    return "border-color: rgba(220, 38, 38, 0.45);";
  }
  return "";
}

function renderTaskCard(task: CodeClawBoardTask, props: CodeClawProps) {
  return html`
    <article class="card" style="margin: 0 0 10px 0; ${statusCardTone(task.status)}">
      <details>
        <summary style="list-style: none; cursor: pointer;">
          <div class="row" style="justify-content: space-between; align-items: flex-start;">
            <div style="flex: 1;">
              <div class="card-title">#${task.id} ${task.title}</div>
              <div class="card-sub">${task.status}</div>
            </div>
            <span
              class="chip"
              style="background: ${roleColor(task.assignedRole)}1a; color: ${roleColor(task.assignedRole)}; border: 1px solid ${roleColor(task.assignedRole)}55;"
            >
              ${roleLabel(task.assignedRole)}
            </span>
          </div>
        </summary>
        <div class="stack" style="margin-top: 10px; gap: 8px;">
          ${task.agentId ? html`<div class="muted">Agent: <code>${task.agentId}</code></div>` : nothing}
          <div>
            <strong>Acceptance Criteria</strong>
            <ul style="margin: 6px 0 0 16px;">
              ${task.acceptanceCriteria.map((item) => html`<li>${item}</li>`)}
            </ul>
          </div>
          <div>
            <strong>Constraints</strong>
            <ul style="margin: 6px 0 0 16px;">
              ${task.constraints.map((item) => html`<li>${item}</li>`)}
            </ul>
          </div>
          <div>
            <strong>Blockers</strong>
            ${
              task.blockers.length === 0
                ? html`<div class="muted">None</div>`
                : html`<ul style="margin: 6px 0 0 16px;">
                    ${task.blockers.map((item) => html`<li>${item}</li>`)}
                  </ul>`
            }
          </div>
          ${task.notes ? html`<div><strong>Notes</strong><div class="muted">${task.notes}</div></div>` : nothing}
          <div class="row">
            <label class="muted" for=${`codeclaw-task-status-${task.id}`}>Move to</label>
            <select
              id=${`codeclaw-task-status-${task.id}`}
              @change=${(event: Event) => {
                const next = (event.target as HTMLSelectElement).value as CodeClawTaskStatus;
                if (!next || next === task.status) {
                  return;
                }
                props.onAdvanceTask(task.id, next);
              }}
            >
              ${STATUS_COLUMNS.map(
                (column) =>
                  html`<option value=${column.key} ?selected=${column.key === task.status}>
                    ${column.label}
                  </option>`,
              )}
            </select>
          </div>
        </div>
      </details>
    </article>
  `;
}

function renderKanbanColumn(
  status: CodeClawTaskStatus,
  label: string,
  tasks: CodeClawBoardTask[],
  props: CodeClawProps,
) {
  return html`
    <section class="card" style="min-width: 220px; flex: 1;">
      <div class="row" style="justify-content: space-between;">
        <div class="card-title">${label}</div>
        <span class="chip">${tasks.length}</span>
      </div>
      <div style="margin-top: 10px;">
        ${
          tasks.length === 0
            ? html`<div class="muted">No tasks</div>`
            : tasks.map((task) => renderTaskCard(task, props))
        }
      </div>
    </section>
  `;
}

function renderLifecycle(props: CodeClawProps) {
  const steps = LIFECYCLE_ORDER.map((role) => {
    const current = props.nextStep?.role === role;
    return html`
      <div
        class="chip"
        style="padding: 8px 10px; border: 1px solid ${current ? "#1d4ed8" : "var(--line)"}; background: ${current ? "rgba(29, 78, 216, 0.12)" : "transparent"};"
      >
        ${roleLabel(role)}
      </div>
    `;
  });
  return html`
    <section class="card">
      <div class="row" style="justify-content: space-between;">
        <div>
          <div class="card-title">Run Plan</div>
          <div class="card-sub">BA → TL → Dev → Tester → Reviewer → PM</div>
        </div>
        <button class="btn" ?disabled=${props.loading} @click=${props.onExecuteNextStep}>
          Execute Next Step
        </button>
      </div>
      <div class="row" style="margin-top: 12px; flex-wrap: wrap;">${steps}</div>
      ${
        props.nextStep
          ? html`
              <div class="callout" style="margin-top: 12px;">
                <strong>Next:</strong> #${props.nextStep.taskId} ${props.nextStep.taskTitle} (${roleLabel(props.nextStep.role)})
              </div>
            `
          : nothing
      }
      ${
        props.runPlan && props.runPlan.length > 0
          ? html`
              <div class="list" style="margin-top: 12px;">
                ${props.runPlan.map(
                  (step) => html`
                    <div class="list-item">
                      <div class="list-main">
                        <div class="list-title">${step.phase} · ${roleLabel(step.role)}</div>
                        <div class="list-sub">#${step.taskId} ${step.taskTitle}</div>
                      </div>
                    </div>
                  `,
                )}
              </div>
            `
          : nothing
      }
    </section>
  `;
}

function renderPhaseHistory(orchestratorState: CodeClawOrchestratorState | null) {
  const history = orchestratorState?.phaseHistory ?? [];
  if (history.length === 0) {
    return html`<div class="muted">No phase history yet.</div>`;
  }
  return html`
    <div class="list">
      ${history.map(
        (entry) => html`
          <div class="list-item">
            <div class="list-main">
              <div class="list-title">${entry.phase}</div>
              <div class="list-sub">
                Started ${new Date(entry.startedAt).toLocaleString()}${entry.completedAt ? ` · Completed ${new Date(entry.completedAt).toLocaleString()}` : ""}
              </div>
              ${entry.notes ? html`<div class="muted">${entry.notes}</div>` : nothing}
            </div>
          </div>
        `,
      )}
    </div>
  `;
}

export function renderCodeClaw(props: CodeClawProps) {
  const board = props.board;
  const phase = props.orchestratorState?.currentPhase ?? "not-started";

  return html`
    <section class="card">
      <div class="row" style="justify-content: space-between;">
        <div>
          <div class="card-title">CodeClaw${board?.projectName ? ` · ${board.projectName}` : ""}</div>
          <div class="card-sub">${props.repoRoot || "Set repo root to start orchestration"}</div>
        </div>
        <div class="row">
          ${
            !board
              ? html`
                  <button class="btn" ?disabled=${props.loading} @click=${props.onInitProject}>
                    Init
                  </button>
                `
              : nothing
          }
          <button class="btn" ?disabled=${props.loading} @click=${props.onRefresh}>
            ${props.loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>
      ${props.error ? html`<div class="callout danger" style="margin-top: 12px;">${props.error}</div>` : nothing}
    </section>

    ${
      !board
        ? html`
            <section class="card">
              <div class="card-title">Project Setup</div>
              <div class="stack" style="margin-top: 12px;">
                <label class="field">
                  <span>Repo Root</span>
                  <input
                    type="text"
                    .value=${props.repoRoot}
                    placeholder="/path/to/repo"
                    @input=${(event: Event) =>
                      props.onRepoRootChange((event.target as HTMLInputElement).value)}
                  />
                </label>
                <label class="field">
                  <span>Project Name</span>
                  <input
                    type="text"
                    .value=${props.projectName}
                    placeholder="OpenClaw Dashboard"
                    @input=${(event: Event) =>
                      props.onProjectNameChange((event.target as HTMLInputElement).value)}
                  />
                </label>
                <div class="row">
                  <button class="btn btn-primary" ?disabled=${props.loading} @click=${props.onInitProject}>
                    Initialize Project
                  </button>
                </div>
                <label class="field">
                  <span>User Goal</span>
                  <textarea
                    rows="3"
                    .value=${props.userGoal}
                    placeholder="Describe the target outcome for this run"
                    @input=${(event: Event) =>
                      props.onUserGoalChange((event.target as HTMLTextAreaElement).value)}
                  ></textarea>
                </label>
                <div class="row">
                  <button class="btn" ?disabled=${props.loading} @click=${props.onPlanRun}>Plan Run</button>
                </div>
              </div>
            </section>
          `
        : nothing
    }

    ${
      board
        ? html`
            <section class="card">
              <div class="row" style="justify-content: space-between;">
                <div>
                  <div class="card-title">Board</div>
                  <div class="card-sub">${board.tasks.length} tasks · next id ${board.nextTaskId}</div>
                </div>
              </div>
              <div class="row" style="margin-top: 12px; align-items: stretch; overflow-x: auto;">
                ${STATUS_COLUMNS.map((column) =>
                  renderKanbanColumn(
                    column.key,
                    column.label,
                    board.tasks.filter((task) => task.status === column.key),
                    props,
                  ),
                )}
              </div>
            </section>
          `
        : nothing
    }

    ${props.runPlan || props.nextStep ? renderLifecycle(props) : nothing}

    <section class="card">
      <div class="card-title">Phase</div>
      <div class="callout" style="margin-top: 10px;">
        <strong>${phase}</strong>
      </div>
      <div style="margin-top: 12px;">
        <div class="card-sub">Phase history</div>
        ${renderPhaseHistory(props.orchestratorState)}
      </div>
    </section>
  `;
}
