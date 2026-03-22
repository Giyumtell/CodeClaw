import type { GatewayBrowserClient } from "../gateway.ts";
import type {
  CodeClawBoard,
  CodeClawOrchestratorState,
  CodeClawRunStep,
  CodeClawStatusResult,
  CodeClawTaskStatus,
} from "../types.ts";

export type CodeClawState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  loading: boolean;
  error: string | null;
  board: CodeClawBoard | null;
  orchestratorState: CodeClawOrchestratorState | null;
  runPlan: CodeClawRunStep[] | null;
  nextStep: CodeClawRunStep | null;
  repoRoot: string;
  projectName: string;
  userGoal: string;
};

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function readRunPlan(value: unknown): CodeClawRunStep[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  return value as CodeClawRunStep[];
}

function readNextStep(value: unknown): CodeClawRunStep | null {
  return asObject(value) as CodeClawRunStep | null;
}

export async function loadCodeClawBoard(state: CodeClawState) {
  if (!state.client || !state.connected || state.loading) {
    return;
  }
  state.loading = true;
  state.error = null;
  try {
    const board = await state.client.request<CodeClawBoard | null>("codeclaw.board", {
      repoRoot: state.repoRoot.trim(),
    });
    state.board = board;
  } catch (err) {
    state.error = String(err);
  } finally {
    state.loading = false;
  }
}

export async function loadCodeClawStatus(state: CodeClawState) {
  if (!state.client || !state.connected || state.loading) {
    return;
  }
  state.loading = true;
  state.error = null;
  try {
    const res = await state.client.request<CodeClawStatusResult>("codeclaw.status", {
      repoRoot: state.repoRoot.trim(),
    });
    state.orchestratorState = res?.orchestratorState ?? null;
    state.board = res?.board ?? state.board;
  } catch (err) {
    state.error = String(err);
  } finally {
    state.loading = false;
  }
}

export async function initCodeClawProject(state: CodeClawState) {
  if (!state.client || !state.connected || state.loading) {
    return;
  }
  state.loading = true;
  state.error = null;
  try {
    const res = await state.client.request<CodeClawStatusResult>("codeclaw.init", {
      repoRoot: state.repoRoot.trim(),
      projectName: state.projectName.trim(),
    });
    state.orchestratorState = res?.orchestratorState ?? state.orchestratorState;
    state.board = res?.board ?? state.board;
  } catch (err) {
    state.error = String(err);
  } finally {
    state.loading = false;
  }
}

export async function planCodeClawRun(state: CodeClawState) {
  if (!state.client || !state.connected || state.loading) {
    return;
  }
  state.loading = true;
  state.error = null;
  try {
    const res = await state.client.request<unknown>("codeclaw.plan", {
      repoRoot: state.repoRoot.trim(),
      projectName: state.projectName.trim(),
      userGoal: state.userGoal.trim(),
    });
    const parsed = asObject(res);
    state.runPlan = readRunPlan(parsed?.runPlan ?? parsed?.steps ?? null);
    state.nextStep = readNextStep(parsed?.nextStep ?? null);
    if (parsed?.board) {
      state.board = parsed.board as CodeClawBoard;
    }
    if (parsed?.orchestratorState) {
      state.orchestratorState = parsed.orchestratorState as CodeClawOrchestratorState;
    }
  } catch (err) {
    state.error = String(err);
  } finally {
    state.loading = false;
  }
}

export async function getCodeClawNextStep(state: CodeClawState) {
  if (!state.client || !state.connected || state.loading) {
    return;
  }
  state.loading = true;
  state.error = null;
  try {
    const res = await state.client.request<unknown>("codeclaw.next", {
      repoRoot: state.repoRoot.trim(),
    });
    const parsed = asObject(res);
    state.nextStep = readNextStep(parsed?.nextStep ?? parsed);
  } catch (err) {
    state.error = String(err);
  } finally {
    state.loading = false;
  }
}

export async function advanceCodeClawTask(
  state: CodeClawState,
  taskId: number,
  newStatus: CodeClawTaskStatus,
) {
  if (!state.client || !state.connected || state.loading) {
    return;
  }
  state.loading = true;
  state.error = null;
  let shouldReloadBoard = false;
  try {
    const res = await state.client.request<unknown>("codeclaw.advance", {
      repoRoot: state.repoRoot.trim(),
      taskId,
      newStatus,
    });
    const parsed = asObject(res);
    if (parsed?.board) {
      state.board = parsed.board as CodeClawBoard;
    } else {
      shouldReloadBoard = true;
    }
    if (parsed?.orchestratorState) {
      state.orchestratorState = parsed.orchestratorState as CodeClawOrchestratorState;
    }
  } catch (err) {
    state.error = String(err);
  } finally {
    state.loading = false;
  }
  if (shouldReloadBoard) {
    await loadCodeClawBoard(state);
  }
}
