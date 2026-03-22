import { Command } from "commander";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const codeClawAssignCommandMock = vi.fn();
const codeClawBoardCommandMock = vi.fn();
const codeClawExecuteCommandMock = vi.fn();
const codeClawInitCommandMock = vi.fn();
const codeClawNextCommandMock = vi.fn();
const codeClawRunCommandMock = vi.fn();
const codeClawStatusCommandMock = vi.fn();

const runtime = {
  log: vi.fn(),
  error: vi.fn(),
  exit: vi.fn(),
};

vi.mock("../../commands/codeclaw.js", () => ({
  codeClawAssignCommand: codeClawAssignCommandMock,
  codeClawBoardCommand: codeClawBoardCommandMock,
  codeClawExecuteCommand: codeClawExecuteCommandMock,
  codeClawInitCommand: codeClawInitCommandMock,
  codeClawNextCommand: codeClawNextCommandMock,
  codeClawRunCommand: codeClawRunCommandMock,
  codeClawStatusCommand: codeClawStatusCommandMock,
}));

vi.mock("../../runtime.js", () => ({
  defaultRuntime: runtime,
}));

let registerCodeClawCommands: typeof import("./register.codeclaw.js").registerCodeClawCommands;

beforeAll(async () => {
  ({ registerCodeClawCommands } = await import("./register.codeclaw.js"));
});

describe("registerCodeClawCommands", () => {
  async function runCli(args: string[]) {
    const program = new Command();
    registerCodeClawCommands(program);
    await program.parseAsync(args, { from: "user" });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    codeClawAssignCommandMock.mockResolvedValue(undefined);
    codeClawBoardCommandMock.mockResolvedValue(undefined);
    codeClawExecuteCommandMock.mockResolvedValue(undefined);
    codeClawInitCommandMock.mockResolvedValue(undefined);
    codeClawNextCommandMock.mockResolvedValue(undefined);
    codeClawRunCommandMock.mockResolvedValue(undefined);
    codeClawStatusCommandMock.mockResolvedValue(undefined);
  });

  it("forwards init options", async () => {
    await runCli([
      "codeclaw",
      "init",
      "--repo-root",
      "/repo/demo",
      "--project-name",
      "Demo",
      "--agent-base-dir",
      "/agents",
      "--json",
    ]);

    expect(codeClawInitCommandMock).toHaveBeenCalledWith(
      {
        repoRoot: "/repo/demo",
        projectName: "Demo",
        agentBaseDir: "/agents",
        json: true,
      },
      runtime,
    );
  });

  it("forwards run options", async () => {
    await runCli([
      "codeclaw",
      "run",
      "--repo-root",
      "/repo/demo",
      "--user-goal",
      "Ship execute flow",
      "--project-name",
      "Demo",
      "--agent-base-dir",
      "/agents",
      "--json",
    ]);

    expect(codeClawRunCommandMock).toHaveBeenCalledWith(
      {
        repoRoot: "/repo/demo",
        userGoal: "Ship execute flow",
        projectName: "Demo",
        agentBaseDir: "/agents",
        json: true,
      },
      runtime,
    );
  });

  it("forwards next options", async () => {
    await runCli([
      "codeclaw",
      "next",
      "--repo-root",
      "/repo/demo",
      "--agent-base-dir",
      "/agents",
      "--json",
    ]);

    expect(codeClawNextCommandMock).toHaveBeenCalledWith(
      {
        repoRoot: "/repo/demo",
        agentBaseDir: "/agents",
        json: true,
      },
      runtime,
    );
  });

  it("forwards board options", async () => {
    await runCli(["codeclaw", "board", "--repo-root", "/repo/demo", "--json"]);

    expect(codeClawBoardCommandMock).toHaveBeenCalledWith(
      {
        repoRoot: "/repo/demo",
        json: true,
      },
      runtime,
    );
  });

  it("forwards execute options", async () => {
    await runCli([
      "codeclaw",
      "execute",
      "--repo-root",
      "/repo/demo",
      "--agent-base-dir",
      "/agents",
      "--spawn",
      "--json",
    ]);

    expect(codeClawExecuteCommandMock).toHaveBeenCalledWith(
      {
        repoRoot: "/repo/demo",
        agentBaseDir: "/agents",
        json: true,
        spawn: true,
      },
      runtime,
    );
  });

  it("forwards assign options", async () => {
    await runCli([
      "codeclaw",
      "assign",
      "--repo-root",
      "/repo/demo",
      "--objective",
      "build status flow",
      "--acceptance",
      "stores task",
      "--constraint",
      "keep it small",
      "--json",
    ]);

    expect(codeClawAssignCommandMock).toHaveBeenCalledWith(
      {
        repoRoot: "/repo/demo",
        objective: "build status flow",
        title: undefined,
        workspaceName: undefined,
        acceptanceCriteria: ["stores task"],
        constraints: ["keep it small"],
        json: true,
      },
      runtime,
    );
  });

  it("forwards status options", async () => {
    await runCli(["codeclaw", "status", "--repo-root", "/repo/demo", "--json"]);

    expect(codeClawStatusCommandMock).toHaveBeenCalledWith(
      {
        repoRoot: "/repo/demo",
        json: true,
      },
      runtime,
    );
  });
});
