# Add Payment validation audit — 28 September 2026

Scope: Single Payment optional amounts and Subscription Period validation UX. No backend, schema, BillingDetailsView or Subscriptions UI changes. Findings describe repository code, not independently verified deployed database constraints.

## Definitions

- **Setup** means the caller supplies `onEstablishCurrentBilling`. This includes the existing Current Billing setup/update path, not just historical entry.
- **Historical-only** means that callback is absent. Its existing optional Currency rule is preserved.
- Blank/whitespace Amount is unknown: empty string in UI state, SQL null through the existing transaction API. `0` and `0.00` remain explicit zero. Stored amounts may be numerically normalized by PostgreSQL.
- Review Payments and Save draft are local only. The explicit **Save Period** click is the existing confirmation/write boundary; no extra confirmation dialog was added.

## Subscription Period: audit of the previous implementation

All messages below previously appeared at the top of the Add Payment modal (or its nested draft editor), unless stated otherwise.

| Field / condition | Previous message / behavior | Blocked | Recommendation and implementation |
|---|---|---|---|
| Plan Name blank | No validation | Neither | Keep optional, including Current Billing setup. |
| Main Billing Type missing / not Monthly or Yearly | `Select Monthly or Yearly billing type.` | Review | Keep required for generating a recurring period; show below Billing Type. |
| Start Date missing / invalid | `Enter a valid Start Date before Next renewal.` | Review | Keep required; give Start Date its own error. |
| Next renewal missing / invalid / not after Start Date | Same combined Start Date message | Review | Keep required; attach a specific error to Next renewal. It need not be after today for a historical period. |
| Start Date in future / no generated payments | `Choose a valid billing period to generate payments.` | Review | Explain future Start Date beside that input; show an empty-generation error by the payment count. |
| No rows after deleting drafts | `Generate at least one billing record before confirming.` | Save | Keep at least one payment required; place error by the empty preview. |
| Setup Currency blank / malformed | `Select a currency for Current Billing.` | Review and Save | Keep setup requirement; show `Select a currency.` or format error below Currency + Amount. |
| Historical-only Currency blank | No validation; API saves null | Neither | Keep optional; do not introduce a new requirement. |
| Historical-only Currency malformed | `Currency must be a three-letter ISO code.` from API | Save | Validate supplied value locally and place near Currency. |
| Setup Amount blank | Already allowed via `amountOptional: true` | Neither | Preserve unknown, never coerce to zero. |
| Setup Amount invalid | `Enter an amount of zero or greater for Current Billing.` | Review and Save | Optional when blank, validate when supplied; place below Currency + Amount. |
| Historical-only Amount invalid | `Transaction amount must be zero or greater.` from API | Save | Catch at Review, before writes, beside Amount. |
| Reviewed row date / currency / amount invalid during setup | `Review payment dates, currencies and amounts before saving.` | Save | Replace combined message with row-specific errors. |
| Reviewed row invalid date in historical-only mode | Database date conversion error; no equivalent local date validation | Save | Validate all period row dates before any write. |
| Reviewed row future date in historical-only mode | Previously accepted; database has no past-date restriction | Neither | Change: period payments represent past/current payments, so reject future dates inline in every period entry path. |
| Status missing / unsupported | Database `billing_transactions_status_check` error | Save | Keep supported statuses required; validate inline. UI defaults to Paid and offers only supported choices. |
| Extra payment / Top-up date missing | `Payment date is required.` | Save draft | Keep required, inline. Validate impossible/future dates before accepting the draft too. |
| Extra payment type blank | Allowed, persisted as null | Neither | Preserve optional historical type. Reject only unsupported supplied types; main period generation still requires Monthly/Yearly. |
| Extra payment amount / currency / status | Mostly deferred to Save Period / API | Save | Apply the same row validation in Save draft and Save Period. Extra rows inherit shared Currency. |
| Notes blank | No validation | Neither | Keep optional. |
| Invoice absent | No validation | Neither | Keep optional. Current control only holds a filename locally: no upload, persistence, size enforcement or invoice requirement. `accept` filters file types in the picker; the displayed 10MB limit is not implemented. |
| No Tool / Account or entry mode selected | Continue disabled, no error message | Before Review | Keep exact relationship selection required. |
| Missing relationship ID | No explicit period guard | API might accept a null relationship | Change: block Review/Save globally rather than write an unassociated transaction. |
| Setup relationship changed / unlinked | `The selected relationship changed.` / `This relationship is no longer linked. Its saved billing and payments remain read-only.` / `The relationship changed or is no longer linked. Reopen Billing Details before saving.` | Save | Keep exact ID guards; global error at top. |
| Current Billing type conflict after merging existing components | `Select one main billing type and optionally Top-up credit (maximum two).` | Save | Catch the visible main-type conflict at Review and show below Billing Type. Do not silently replace another component. |
| Other existing Current Billing component invalid | Existing `subscriptionBillingPatch` validation messages | Save, setup only | Keep validation. A failure in existing configuration outside this form remains a save failure; correct that configuration through Current Billing. |
| Signed out | `Please sign in before saving billing transactions.` | Save | Keep global error. Review remains offline/local and does not authenticate or write. |
| Database / network / RLS / deleted relationship | Returned service message, or `Could not save subscription period.` fallback | Save | Keep global error at top; retain drafts. |

## Final Subscription Period blocking conditions and messages

| Condition | Final message | Location | Blocks |
|---|---|---|---|
| Main type missing / unsupported | `Select Monthly or Yearly billing type.` | Below Billing Type | Review; rechecked on Save |
| Setup type conflicts with existing main type | `Current Billing already has another main billing type. Choose its billing type or update Current Billing first.` | Below Billing Type | Review; rechecked on Save |
| Start Date missing / impossible | `Enter a valid Start Date.` | Below Start Date | Review; rechecked on Save |
| Start Date future | `Start Date must be today or earlier to generate payments.` | Below Start Date | Review; rechecked on Save |
| Next renewal missing / impossible | `Enter a valid Next renewal date.` | Below Next renewal | Review; rechecked on Save |
| Next renewal not after Start Date | `Next renewal must be after Start Date.` | Below Next renewal | Review; rechecked on Save |
| Setup Currency blank | `Select a currency.` | Currency + Amount / relevant row | Review / Save / Save draft |
| Supplied Currency malformed | `Currency must be a three-letter ISO code.` | Currency + Amount / relevant row | Review / Save / Save draft |
| Supplied Amount negative / malformed | `Enter an amount of zero or greater.` | Currency + Amount / relevant row | Review / Save / Save draft |
| Amount over database range, including rounding overflow | `Enter an amount below 1,000,000,000,000.` | Currency + Amount / relevant row | Review / Save / Save draft |
| Status unsupported | `Select a valid payment status.` | Below Status / row Status | Review / Save / Save draft |
| Empty generated period | `Choose a billing period that generates at least one payment.` | Beside payment count | Review |
| All preview rows removed | `Add at least one payment before saving.` | Below preview | Save |
| Row date missing / impossible | `Enter a valid Payment Date.` | Beside row date / below editor date | Save / Save draft |
| Row date future | `Payment Date must be today or earlier.` | Beside row date / below editor date | Save / Save draft |
| Supplied row type unsupported | `Select a valid billing type.` | Beside row type | Save / Save draft |
| Missing relationship | `The account relationship could not be identified. Reopen Add Payment.` | Modal top | Review / Save |
| Auth, relationship, Current Billing persistence, database or reload failure | Existing service error / fallback | Modal top | Save |

Header errors detected from Save return to the header form so the affected input is visible. Row errors stay in the review. After a validation attempt, field feedback updates as values are corrected. No field-error redesign or horizontal scrolling was introduced.

Generation remains anchored to the original Start Date with month-end clamping, excludes Next renewal itself, excludes future payments and caps generation at 1,200 rows. Those are existing generation rules, not new required fields. Edited/extra dates are not required to remain within the original period; they must be valid past/current dates.

## Final Single Payment blockers

- At least one billing type selected; existing picker combination rules remain.
- Each base component needs a valid explicit Payment Date, or a valid Next renewal from which Monthly/Yearly can infer the preceding cycle. Non-recurring components cannot infer a payment date.
- Each additional Top-up needs a date.
- Monthly/Yearly payment dates cannot be future. Setup also validates every base/extra date as valid and past/current. Existing historical-only non-recurring future-date behavior was not changed by this amount fix.
- Setup requires valid Currency and a valid Next renewal for recurring components, even when an explicit Payment Date exists. Existing historical-only optional Currency behavior is unchanged; malformed supplied Currency still fails API validation.
- Every supplied base or extra amount must be a nonnegative decimal within the transaction amount range. Blank/whitespace is accepted before Current Billing setup and payment writes. Zero is valid.
- Existing exact relationship, merged Current Billing validation, authentication, status/database constraints and save failures still apply. The initial locked multi-component selector still requires a component choice when applicable.
- Plan Name, Notes and Invoice remain optional. No new currency rule was introduced.

## Persistence / hidden backend audit

- `createBillingTransaction` reads the exact `tool_email_links.id` to snapshot tool/login identity, then inserts `billing_transactions`. It never substitutes another account. Historical writes do not themselves enforce `unlinked_at`; setup additionally checks the active exact relationship via `subscriptionTarget` and `updateToolLinkDetails`.
- Repository migration 0023 requires payment_date, user_id, source and a supported status. Billing type and Currency may be null; supplied types are constrained to Monthly, Yearly, Lifetime, One-time, Top-up, Currency to three uppercase letters, and amount to nonnegative `numeric(18,6)` (12 integer digits, six fractional digits). PostgreSQL rounds extra fractional precision. The local amount check catches range/rounding overflow without converting unknown to zero.
- Foreign keys and owner RLS restrict relationship/tool/login access. Permission failures, deleted rows, malformed IDs, network and database failures remain global. Exact database-generated wording varies; there is no stable frontend message for every server failure.
- `(user_id, source, source_key)` is unique. The API retrieves the existing transaction on a matching duplicate source key, rather than adding another. Generated period keys remain tied to relationship/type/original generation date; editing a draft does not regenerate its key.
- Current Billing writes are separate from historical snapshot writes. In setup mode the existing callback runs first; payment inserts then run independently via Promise.all. These operations are not atomic. A later failure can leave Current Billing saved or some payments recorded; the existing partial-save notice and retry keys remain. This task does not change transaction orchestration or schema.
- Review, Back, Save draft, draft deletion and Cancel do not write. Save Period is the explicit commit point. Plan/amount corrections to Current Billing do not rewrite earlier transaction snapshots.

## Verification

- Focused `scripts/test-subscriptions-phase3.cjs`: passes. Added coverage for blank/whitespace/zero/positive base and additional amounts; invalid amounts blocking all writes; period header/row/date/status/currency validation; zero-write Review; zero-write invalid Save; exact setup/payment relationship IDs; null serialization and dash/zero display; amount range boundaries and Current Billing type conflicts. Existing snapshot/isolation/retry tests still pass.
- `pnpm typecheck`: passes.
- `git diff --check`: passes (existing Windows LF/CRLF warnings only).
- Browser: verified inline main type/date errors, correction feedback, invalid Amount feedback, blank Amount reaching preview, invalid reviewed amount blocked at its row, and extra-payment date validation beside the input. Discarded all test drafts; did not perform a successful live save.
- Successful persistence is covered with local persistence spies and serializer checks, not new live database records. No commits or pushes.
