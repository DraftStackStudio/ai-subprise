# Resume Subscription contract

## Scope

Resume records a subscription that the user has already resumed with the AI
provider. It does not contact the provider and planned Resume dates never
trigger it automatically.

This workflow supports only a linked, paid, Paused relationship whose current
Pause lifecycle event references an exact retired Monthly or Yearly billing
component. Pay-per-use, non-recurring billing, historical corrections, and plan
changes are outside this contract.

## User decisions

- Resume is effective on the user's current local calendar date. It cannot be
  backdated or future-dated.
- The plan is preserved and is not editable during Resume.
- The previous frequency, currency, and amount are prefilled. The user may
  change these values before confirming Resume.
- Blank amount means unknown. It is never converted to zero.
- The suggested next renewal is one selected billing cycle after today. It is
  a draft only; the user must confirm it, replace it, or explicitly select
  Unknown.
- A manually entered next renewal survives later frequency changes in the
  form. Only an untouched suggestion is recalculated.
- A known next renewal must be later than the Resume date. Unknown is stored
  as null and leaves Current Billing incomplete until the user supplies it.
- The new component's recurrence anchor equals the confirmed next renewal. If
  the date is unknown, both values are null and renewal detection does nothing.

## Atomic Resume write

`resume_subscription` owns only the lifecycle transition. In one transaction
it validates the exact owned relationship, current Pause event, and retired
recurring component; creates one new recurring component; creates one Resume
lifecycle event; and changes the relationship from Paused to Active.

It never changes the Pause event, retired component, renewal periods,
resolutions, exclusions, renewal activity, or Payments. The request UUID is
the Resume event UUID. Matching retries return the original result; conflicting
reuse fails. Relationship and request advisory locks plus row locks prevent
duplicate concurrent Resume operations.

## Payment boundary

The UI asks whether the provider charged the user on Resume. Yes opens a
separate payment draft; No or Not sure creates no payment. A payment is written
only after explicit confirmation, after Resume succeeds, using a deterministic
source key based on the Resume event. A payment failure does not undo the true
Active lifecycle state and can be retried without duplicating the payment.

Migration 0033 and the Resume RPC do not create or modify Payments. The
application's optional Resume Payment step remains a separate, explicitly
confirmed write after Resume succeeds.

## Account Activity

The Resume event stores immutable plan, frequency, currency, amount, and next
renewal snapshots. Activity will show exactly one ledger-backed Resume entry.
The original Pause entry and its informational planned Resume date remain
unchanged. A separately confirmed payment appears only as a Payment.

## Controlled live verification

The dedicated A034 controlled Resume E2E test passed on 16 October 2026 using
the paused primary relationship and the approved pre-Resume Result 2 baseline.
The submitted values were TEST Monthly Primary, Monthly, SGD 30.84, a known
and explicitly confirmed next renewal of 16 November 2026, and provider charge
Not sure.

Post-Resume Result 2 verified:

- the primary relationship became Active with next renewal 16 November 2026;
- exactly one current recurring component was created:
  `c5eb10a9-51b2-4ea3-ae3c-521fecaa68cb`;
- exactly one Resume lifecycle event was created:
  `764e7f3c-ffec-4b20-bd97-98d116064dd4`;
- no Payment, renewal period, or renewal activity was created;
- the original Pause event and retired recurring component were preserved; and
- the A034 control relationship and all non-fixture fingerprints were
  unchanged.

This evidence covers the approved Known-date and Not-sure charge path. The
separate Resume Payment path remains covered by local contract tests rather
than this live E2E result.
