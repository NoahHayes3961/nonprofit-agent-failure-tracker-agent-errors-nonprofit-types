import test from 'node:test';
import assert from 'node:assert/strict';
import { decideFailureAction, nonprofitAgentRequestSchema } from './nonprofit_agent_loop';

test('donor receipt failures are held for review on first failure', () => {
  const input = nonprofitAgentRequestSchema.parse({
    workflowId: 'wf_receipt_2026_01',
    runId: 'run_00042',
    nonprofitId: 'np_southside_food_bank',
    operation: 'donor_receipt',
    actorId: 'donor_1188',
    amountCents: 5000,
    attempts: 0,
    errorName: 'TemplateRenderError',
    errorMessage: 'receipt template missed a donor merge field',
    exception: 'TemplateRenderError: receipt template missed a donor merge field'
  });

  const result = decideFailureAction(input);

  assert.equal(result.status, 'held_for_review');
  assert.equal(result.metricName, 'agent_hold_created');
  assert.deepEqual(result.fingerprint, ['np_southside_food_bank', 'donor_receipt', 'TemplateRenderError']);
});

test('volunteer reminder failures retry before human review', () => {
  const input = nonprofitAgentRequestSchema.parse({
    workflowId: 'wf_reminder_2026_01',
    runId: 'run_00077',
    nonprofitId: 'np_southside_food_bank',
    operation: 'volunteer_reminder',
    actorId: 'volunteer_91',
    dueInHours: 6,
    attempts: 1,
    errorName: 'EmailProviderError',
    errorMessage: 'temporary mail refusal',
    exception: 'EmailProviderError: temporary mail refusal'
  });

  const result = decideFailureAction(input);

  assert.equal(result.status, 'retrying');
  assert.equal(result.metricName, 'agent_retry_scheduled');
});
