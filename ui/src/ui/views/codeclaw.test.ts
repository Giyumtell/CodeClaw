// @vitest-environment jsdom

import { render } from "lit";
import { describe, expect, it, vi } from "vitest";
import type { CodeClawBoard, CodeClawOrchestratorState, CodeClawRunStep } from "../types.ts";
import { renderCodeClaw, type CodeClawProps } from "./codeclaw.ts";

function createProps(overrides: Partial<CodeClawProps> = {}): CodeClawProps {
  return {
    loading: false,
    error: null,
    board: null,
    orchestratorState: null,
    runPlan: null,
    nextStep: null,
    repoRoot: "/repo",
    projectName: "OpenClaw",
    userGoal: "Ship dashboard",
    onRepoRootChange: () => undefined,
    onProjectNameChange: () => undefined,
    onUserGoalChange: () => undefined,
    onInitProject: () => undefined,
    onPlanRun: () => undefined,
    onRefresh: () => undefined,
    onExecuteNextStep: () => undefined,
    onAdvanceTask: () => undefined,
    ...overrides,
  };
}

function createBoard(): CodeClawBoard {
  return {
    projectName: "OpenClaw",
    repoRoot: "/repo",
    nextTaskId: 3,
    tasks: [
      {
        id: 1,
        title: "Define acceptance criteria",
        status: "backlog",
        assignedRole: "business-analyst",
        acceptanceCriteria: ["Criteria A"],
        constraints: ["Constraint A"],
        blockers: [],
        createdAt: "2026-03-22T00:00:00Z",
        updatedAt: "2026-03-22T00:00:00Z",
      },
    ],
  };
}

function createState(): CodeClawOrchestratorState {
  return {
    projectName: "OpenClaw",
    repoRoot: "/repo",
    currentPhase: "planning",
    userGoal: "Ship dashboard",
    phaseHistory: [{ phase: "planning", startedAt: "2026-03-22T00:00:00Z", notes: "Started" }],
  };
}

function createNextStep(): CodeClawRunStep {
  return {
    phase: "implementation",
    role: "developer",
    agentId: "dev-1",
    taskId: 1,
    taskTitle: "Define acceptance criteria",
    directive: "Build it",
  };
}

describe("codeclaw view", () => {
  it("renders project setup when board is missing", () => {
    const container = document.createElement("div");
    render(renderCodeClaw(createProps()), container);

    expect(container.textContent).toContain("Project Setup");
    expect(container.textContent).toContain("Initialize Project");
  });

  it("renders board and shows task details when expanded", () => {
    const container = document.createElement("div");
    render(
      renderCodeClaw(
        createProps({
          board: createBoard(),
          orchestratorState: createState(),
        }),
      ),
      container,
    );

    expect(container.textContent).toContain("Board");
    expect(container.textContent).toContain("Define acceptance criteria");

    const taskSummary = container.querySelector("article.card details summary");
    expect(taskSummary).not.toBeNull();
    taskSummary?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(container.textContent).toContain("Acceptance Criteria");
  });

  it("calls Execute Next Step callback", () => {
    const container = document.createElement("div");
    const onExecuteNextStep = vi.fn();
    render(
      renderCodeClaw(
        createProps({
          runPlan: [createNextStep()],
          nextStep: createNextStep(),
          onExecuteNextStep,
        }),
      ),
      container,
    );

    const button = Array.from(container.querySelectorAll("button")).find(
      (entry) => entry.textContent?.trim() === "Execute Next Step",
    );
    expect(button).not.toBeUndefined();
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onExecuteNextStep).toHaveBeenCalledTimes(1);
  });
});
