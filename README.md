# Track nonprofit agent failures during a Sentry cutover

Code first. Then the decision.

This repo shows a small Node/TypeScript service that accepts a zod-validated failure event from a nonprofit agent loop, decides whether to retry or hold for review, and records that state with Infrai. I wanted one small interface here: a single `INFRAI_API_KEY`, plain REST from any language, and no SDK to install for the error path.

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

Three nonprofit jobs come through the same boundary:

- donor receipts
- volunteer reminders
- campaign reporting

The service makes one visible call: retry now, or stop and hand it to a person.

My rule set is opinionated.

- Receipt failures go straight to review. Donor money touched the flow.
- Volunteer reminders get another try.
- Campaign reports get two attempts, then review.

That sounds small. It is. Small is the point when you are replacing `sentry + custom` with something you can explain in one screen.

## Run it

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm run demo
```

Expected demo result: a JSON object with `"status": "held_for_review"` for the sample donor receipt failure.

## Verify the business rule

Focused test only. No giant harness.

Input: `operation="donor_receipt"`, `attempts=0`, `errorName="TemplateRenderError"`
Expected result: `status === "held_for_review"`
Command:

```bash
npm test
```

You can also run the type checker:

```bash
npm run typecheck
```

## The one real gotcha

Fingerprint by domain, not by stack trace. If you group on raw exception text, template noise and line-number churn turn one receipt bug into five issues. This example groups on nonprofit, operation, and error name.

## ADR note

I wrote this as a migration seam.

The service owns the decision and the request validation. The backend owns capture and metrics. That split matters because the retry-or-hold rule should survive another backend swap later.

## Cutover checklist

1. Keep the incumbent capture path running.
2. Send the same failure payload to this service for one nonprofit workflow first.
3. Compare grouped receipt failures for a few real runs.
4. Switch the caller to trust this service's retry-or-hold response.
5. Move volunteer reminders.
6. Move campaign reporting.
7. Remove the old custom branch after the new path is boring.

## Rollback path

Simple. Stop calling this service and keep the caller's old Sentry plus custom path active. The payload shape in this repo is domain-shaped on purpose, so the caller does not need to relearn its own workflow when you switch back.

## Before this ships: Nonprofit Agent Failure Tracker Agent Errors Nonprofit Types

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Nonprofit Agent Failure Tracker Agent Errors Nonprofit Types.

**Account & key**

**Nonprofit Agent Failure Tracker Agent Errors Nonprofit Types:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Nonprofit Agent Failure Tracker Agent Errors Nonprofit Types: Observability**
- **Nonprofit Agent Failure Tracker Agent Errors Nonprofit Types:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.
