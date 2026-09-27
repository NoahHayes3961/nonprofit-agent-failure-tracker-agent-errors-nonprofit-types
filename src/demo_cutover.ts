import { trackNonprofitAgentFailure } from './nonprofit_agent_loop';

async function main(): Promise<void> {
  const result = await trackNonprofitAgentFailure({
    workflowId: 'wf_receipt_2026_01',
    runId: 'run_00042',
    nonprofitId: 'np_southside_food_bank',
    operation: 'donor_receipt',
    actorId: 'donor_1188',
    amountCents: 5000,
    attempts: 0,
    errorName: 'TemplateRenderError',
    errorMessage: 'receipt template missed a donor merge field',
    exception: 'TemplateRenderError: receipt template missed a donor merge field\n    at receipt_sender.ts:18:9'
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
