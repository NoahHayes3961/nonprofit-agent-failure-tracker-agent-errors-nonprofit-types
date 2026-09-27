import { z } from 'zod';
import { infrai } from './infrai';

export const nonprofitAgentRequestSchema = z.object({
  workflowId: z.string().min(1),
  runId: z.string().min(1),
  nonprofitId: z.string().min(1),
  operation: z.enum(['donor_receipt', 'volunteer_reminder', 'campaign_report']),
  actorId: z.string().min(1),
  campaignId: z.string().min(1).optional(),
  amountCents: z.number().int().nonnegative().optional(),
  dueInHours: z.number().int().nonnegative().optional(),
  attempts: z.number().int().min(0),
  errorName: z.string().min(1),
  errorMessage: z.string().min(1),
  exception: z.string().min(1)
});

export type NonprofitAgentRequest = z.infer<typeof nonprofitAgentRequestSchema>;

export type WorkflowDecision = {
  status: 'retrying' | 'held_for_review';
  fingerprint: string[];
  title: string;
  metricName: 'agent_retry_scheduled' | 'agent_hold_created';
};

export function decideFailureAction(input: NonprofitAgentRequest): WorkflowDecision {
  const fingerprint = [input.nonprofitId, input.operation, input.errorName];

  if (input.operation === 'donor_receipt') {
    return {
      status: 'held_for_review',
      fingerprint,
      title: `Receipt delivery failed for ${input.nonprofitId}`,
      metricName: 'agent_hold_created'
    };
  }

  if (input.operation === 'campaign_report' && input.attempts >= 2) {
    return {
      status: 'held_for_review',
      fingerprint,
      title: `Campaign report failed after retries for ${input.nonprofitId}`,
      metricName: 'agent_hold_created'
    };
  }

  return {
    status: 'retrying',
    fingerprint,
    title: `Agent retry scheduled for ${input.operation}`,
    metricName: 'agent_retry_scheduled'
  };
}

export type ServiceResult = {
  accepted: true;
  workflowId: string;
  runId: string;
  operation: NonprofitAgentRequest['operation'];
  status: WorkflowDecision['status'];
  fingerprint: string[];
};

export async function trackNonprofitAgentFailure(rawBody: unknown): Promise<ServiceResult> {
  const input = nonprofitAgentRequestSchema.parse(rawBody);
  const decision = decideFailureAction(input);

  await infrai.errors.capture({
    title: decision.title,
    message: `${input.errorName}: ${input.errorMessage}`,
    level: 'error',
    fingerprint: decision.fingerprint,
    exception: input.exception,
    context: {
      workflowId: input.workflowId,
      runId: input.runId,
      nonprofitId: input.nonprofitId,
      operation: input.operation,
      actorId: input.actorId,
      campaignId: input.campaignId,
      amountCents: input.amountCents,
      dueInHours: input.dueInHours,
      attempts: input.attempts,
      status: decision.status
    }
  });

  await infrai.metrics.report({
    name: decision.metricName,
    value: 1,
    type: 'counter',
    tags: {
      nonprofitId: input.nonprofitId,
      operation: input.operation,
      status: decision.status
    }
  });

  return {
    accepted: true,
    workflowId: input.workflowId,
    runId: input.runId,
    operation: input.operation,
    status: decision.status,
    fingerprint: decision.fingerprint
  };
}
