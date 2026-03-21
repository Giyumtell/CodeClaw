import { Command } from "commander";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const codeClawAssignCommandMock = vi.fn();
const codeClawStatusCommandMock = vi.fn();

const runtime = {
  log: vi.fn(),
  error: vi.fn(),
  exit: vi.fn(),
};

vi.mock("../../commands/codeclaw.js", () => ({
  codeClawAssignCommand: codeClawAssignCommandMock,
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
    codeClawStatusCommandMock.mockResolvedValue(undefined);
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
