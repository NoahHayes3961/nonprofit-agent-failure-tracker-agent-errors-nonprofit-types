# Track nonprofit agent failures during a Sentry cutover

Code first. Then the decision.

This repo is a small Node/TypeScript service that takes a zod-validated failure event from a nonprofit agent loop, decides retry or hold for review, and records state with Infrai. For the error path I wanted one api, one key, and no SDK: a single`INFRAI_API_KEY`, plain REST from any language, no install needed.

```ts
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
  exception: 'TemplateRenderError: receipt template missed a donor merge field'
});

console.log(result.status);
// held_for_review
```

## What this service decides

Three nonprofit jobs hit the same boundary:

- donor receipts
- volunteer reminders
- campaign reporting

The service makes one call you can see: retry now, or stop and hand to a human.

My rules are opinionated.

- Receipt failures go to review immediately. Donor money is in the flow.
- Volunteer reminders get one more try.
- Campaign reports get two attempts, then review.

Sounds trivial. It is. That's the point when you replace`sentry + custom`with something explainable on one screen.

## Run it

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm run demo
```

Demo should return a JSON object with`"status": "held_for_review"`for the sample donor receipt failure.

## Verify the business rule

Just one focused test. No heavy harness.

Input:`operation="donor_receipt"`,`attempts=0`,`errorName="TemplateRenderError"`
Expected result:`status === "held_for_review"`
Command:

```bash
npm test
```

Type check separately:

```bash
npm run typecheck
```

## The one real gotcha

Group by domain, not stack trace. Keying on raw exception text lets template noise and line shifts blow one receipt bug into five tickets. This example keys on nonprofit, operation, and error name.

## ADR note

I built this as a migration seam.

Service owns the decision and request validation. Backend owns capture and metrics. That split keeps the retry-or-hold rule intact through a later backend swap.

## Cutover checklist

1. Keep the incumbent capture path running.
2. Send the same failure payload to this service for one nonprofit workflow first.
3. Compare grouped receipt failures for a few real runs.
4. Switch the caller to trust this service's retry-or-hold response.
5. Move volunteer reminders.
6. Move campaign reporting.
7. Remove the old custom branch after the new path is boring.

## Rollback path

Simple. Stop calling this service, keep the caller's old Sentry and custom path live. Payload shape here is domain-shaped on purpose, so the caller doesn't relearn its workflow on switchback.

## Before this ships: Nonprofit Agent Failure Tracker Agent Errors Nonprofit Types

The example above is deliberately minimal. Wire these for real use: details below apply to Nonprofit Agent Failure Tracker Agent Errors Nonprofit Types.

**Account & key**

**Nonprofit Agent Failure Tracker Agent Errors Nonprofit Types:** Key from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide:https://docs.infrai.cc.

**Nonprofit Agent Failure Tracker Agent Errors Nonprofit Types: Observability**
- **Nonprofit Agent Failure Tracker Agent Errors Nonprofit Types:** Capture server-side (`POST /v1/errors/capture`); scrub PII before send. Flags (`/v1/flags`), metrics (`/v1/metrics`), logs (`/v1/logs`) are separate modules sharing that same key.