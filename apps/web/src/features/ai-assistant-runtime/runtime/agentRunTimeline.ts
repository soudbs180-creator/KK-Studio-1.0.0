import type { AgentRunRecord } from './AgentRunStore.ts';

export type AgentRunTimelineStepId =
  | 'intent'
  | 'planner'
  | 'permission'
  | 'executor'
  | 'verification';

export type AgentRunTimelineStepStatus =
  | 'pending'
  | 'active'
  | 'done'
  | 'needs_confirmation'
  | 'failed'
  | 'cancelled';

export interface AgentRunTimelineStep {
  id: AgentRunTimelineStepId;
  label: string;
  description: string;
  status: AgentRunTimelineStepStatus;
  detail?: string;
}

const DEFAULT_STEPS: Array<Omit<AgentRunTimelineStep, 'status' | 'detail'>> = [
  {
    id: 'intent',
    label: 'IntentGate',
    description: 'Understands the user goal and selects the takeover intent.',
  },
  {
    id: 'planner',
    label: 'Planner',
    description: 'Turns the intent into structured actions.',
  },
  {
    id: 'permission',
    label: 'PermissionPolicy',
    description: 'Checks safety boundaries and confirmation needs.',
  },
  {
    id: 'executor',
    label: 'Executor',
    description: 'Runs approved tools through ToolRegistry.',
  },
  {
    id: 'verification',
    label: 'Verification / Memory',
    description: 'Writes verification state and handoff memory.',
  },
];

function countLabel(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function pendingSteps(): AgentRunTimelineStep[] {
  return DEFAULT_STEPS.map(step => ({
    ...step,
    status: 'pending',
  }));
}

export function buildAgentRunTimeline(record?: AgentRunRecord | null): AgentRunTimelineStep[] {
  if (!record) {
    return pendingSteps();
  }

  const status = record.status;
  const actions = Array.isArray(record.plan?.actions) ? record.plan.actions : [];
  const toolCalls = Array.isArray(record.toolCalls) ? record.toolCalls : [];
  const nextStep = typeof record.nextStep === 'string' ? record.nextStep : '';
  const blockedByPolicy = status === 'failed' && /安全|拦截|blocked|permission|policy/i.test(nextStep);

  const permissionStatus: AgentRunTimelineStepStatus =
    status === 'waiting_confirmation'
      ? 'needs_confirmation'
      : status === 'cancelled'
        ? 'cancelled'
        : blockedByPolicy
          ? 'failed'
          : 'done';

  const executorStatus: AgentRunTimelineStepStatus =
    status === 'waiting_confirmation' || status === 'planning'
      ? 'pending'
      : status === 'running'
        ? 'active'
        : status === 'completed' || status === 'completed_with_errors'
          ? 'done'
          : status === 'cancelled'
            ? 'cancelled'
            : 'failed';

  const verificationStatus: AgentRunTimelineStepStatus =
    status === 'completed' || status === 'completed_with_errors'
      ? 'done'
      : status === 'failed'
        ? 'failed'
        : status === 'cancelled'
          ? 'cancelled'
          : 'pending';

  return [
    {
      ...DEFAULT_STEPS[0],
      status: 'done',
      detail: record.intent || 'Intent resolved',
    },
    {
      ...DEFAULT_STEPS[1],
      status: 'done',
      detail: countLabel(actions.length, 'action'),
    },
    {
      ...DEFAULT_STEPS[2],
      status: permissionStatus,
      detail: status === 'waiting_confirmation'
        ? 'User confirmation required'
        : blockedByPolicy
          ? nextStep
          : 'Policy evaluated',
    },
    {
      ...DEFAULT_STEPS[3],
      status: executorStatus,
      detail: status === 'waiting_confirmation'
        ? 'Waiting for confirmation'
        : countLabel(toolCalls.length, 'tool call'),
    },
    {
      ...DEFAULT_STEPS[4],
      status: verificationStatus,
      detail: status === 'completed' || status === 'completed_with_errors'
        ? status === 'completed_with_errors'
          ? 'Verification completed with partial failures recorded'
          : 'Handoff and knowledge update recorded'
        : nextStep || 'Handoff and knowledge update after execution',
    },
  ];
}
