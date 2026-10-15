# Phase 2B2-A5.1 disposable Pause test plan

This plan and its SQL files are preparation only. A5.1 performs no database writes, creates no fixture, and calls no RPC.

## Safety review outcome

The original A4 proposal was directionally correct but was not safe to execute unchanged:

- `scripts/test-pause-subscription-foundation.sql` selects the oldest existing Auth user and impersonates it inside a rollback-only transaction. A committed browser fixture must not reuse that convention. It requires a new, dedicated Auth user with no existing public data.
- The relationship column is `plan`, not `plan_status`.
- The browser generates the Pause request UUID. It cannot be assumed to use a reserved `a034...` ID; the resulting ledger ID must be captured after submission.
- The RPC can materialise renewal periods with generated UUIDs. Prefix-only cleanup would miss them.
- Authenticated clients cannot delete lifecycle events, renewal periods, or renewal activity. Setup and cleanup require privileged manual execution in Supabase SQL Editor. RLS must remain enabled.
- Deleting the Auth user is not sufficient cleanup because ownership columns on `ai_tools`, `logins`, and `tool_email_links` are not all cascading Auth foreign keys. Public fixture rows must be removed first in foreign-key-safe order.

The corrected scripts fail closed on an unreplaced user UUID, an unexpected owner, a reserved-ID collision, an existing public row for the test user, an unexpected component/event/transaction/activity, or a cleanup postcondition failure.

## Identity and fixture manifest

Create one confirmed Auth user in Supabase Authentication:

- Email: replace `REPLACE_WITH_DELIVERABLE_AUTH_EMAIL` in all four fixture SQL scripts with the same separate, deliverable test-account email.
- Purpose: Phase 2B2-A5 disposable browser testing only
- It must be newly created and must own zero public records before setup.
- Its password remains with the human tester and must not be placed in SQL or repository files.

Reserved public IDs:

| Record | ID |
| --- | --- |
| Primary login | `a0340000-0000-0000-0000-000000000101` |
| Isolation login | `a0340000-0000-0000-0000-000000000102` |
| Shared AI tool | `a0340000-0000-0000-0000-000000000201` |
| Primary relationship | `a0340000-0000-0000-0000-000000000301` |
| Isolation relationship | `a0340000-0000-0000-0000-000000000302` |
| Primary Monthly component | `a0340000-0000-0000-0000-000000000401` |
| Primary Top-up component | `a0340000-0000-0000-0000-000000000402` |
| Isolation Monthly component | `a0340000-0000-0000-0000-000000000403` |
| Five seeded renewal periods | `a034...0501` through `a034...0505` |
| Two protected Payments | `a034...0601` and `a034...0602` |
| Protected renewal activity | `a034...0701` |

The Pause ledger ID and any RPC-materialised renewal-period IDs are generated operational IDs. They are accepted only when owned by the dedicated user and attached to the exact primary relationship/component. They are listed by the verification script and captured by the guarded cleanup script.

## Isolation model

Both relationships use the same fixture AI tool but different fixture logins. Each is Active/Paid with its own current Monthly component and future `next_renewal_date`. A future next-renewal date prevents the dashboard loader from invoking unrelated overdue-renewal sync before the test.

The primary relationship additionally has a Top-up component, pre-effective unresolved period, effective-date unresolved period, post-effective unresolved period, resolved future period, historical Payment, and renewal-activity row. The isolation relationship has its own unresolved period and Payment.

The Pause RPC is `SECURITY DEFINER` with `search_path=public`, but uses `auth.uid()` and selects the exact relationship by both `id` and `user_id`. Only `authenticated` has execute permission; `anon` and `PUBLIC` do not. The UI call must be made while signed in as the dedicated Auth user, proving the normal permission path.

## Expected Pause write set

Only the primary fixture relationship may change:

| Table | Expected result |
| --- | --- |
| `tool_email_links` | Primary status becomes `Paused`; `next_charge_date` becomes null. Isolation relationship is byte-for-byte unchanged. |
| `tool_link_billing_components` | Primary Monthly component receives `retired_at`; its existing update trigger also refreshes `updated_at`. Top-up and isolation components are unchanged. |
| `subscription_lifecycle_events` | Exactly one `paused` event is created using the UI request UUID and stored effective-date metadata. |
| `billing_renewal_periods` | Cadence rows through the effective date may be materialised. Only unresolved rows with effective billing dates after Pause receive `excluded_at` / `excluded_by_lifecycle_event_id`; their existing update trigger also refreshes `updated_at`. |

`billing_transactions` and `billing_renewal_activity` must remain byte-for-byte unchanged. The RPC definition contains no writes to either table.

## Manual execution sequence

### Checkpoint 0: application and source validation

Codex may run local static tests, typecheck, and `git diff --check`. These do not require database approval. Codex must not create the Auth user, execute SQL in Supabase, sign in as the disposable user, or click Confirm Pause without separate approval.

Expected result: all local checks pass and the working tree contains only the reviewed A1-A5.1 files.

### Checkpoint 1: create the dedicated Auth user

Requires explicit approval and a human action in Supabase Authentication. Create and confirm a separate, deliverable test-account email. Do not reuse an existing account. Before any SQL execution, replace every `REPLACE_WITH_DELIVERABLE_AUTH_EMAIL` placeholder with that exact email in the preflight, fixture-creation, verification, and cleanup scripts.

Expected result: one new Auth UUID, with no public application rows.

### Checkpoint 2: read-only structural preflight

Replace the zero UUID in `scripts/preflight-pause-e2e-fixture.sql` with the exact Auth UUID and run it manually in Supabase SQL Editor.

Expected result: `pause_e2e_fixture_preflight_passed = true`; zero reserved-ID conflicts; zero public rows owned by the test user; correct RPC execution grants; RLS and owner-scoped SELECT policies present on all fixture tables; client writes blocked on ledger/period/activity tables; Pause and renewal sync using the same relationship lock. Review the returned foreign keys before proceeding.

### Checkpoint 2A: save the pre-fixture non-fixture baseline

Run `scripts/verify-pause-e2e-fixture.sql` before creating any public fixture rows. Save the complete `non_fixture` fingerprint object and the final phase-aware result.

Expected result: `fixture_stage = 'absent'` and `pause_e2e_fixture_state_passed = true`. This is the comparison baseline proving fixture setup, Pause, and cleanup do not alter any row outside the two reserved relationships.

### Checkpoint 3: create the committed fixture

Requires a second explicit approval. Replace the zero UUID in `scripts/create-pause-e2e-fixture.sql` and run it manually in Supabase SQL Editor. The script is one transaction and rolls back automatically on any guard or postcondition failure.

Expected result: one tool, two logins, two relationships, three components, five seeded periods, two Payments, one renewal-activity row, and zero lifecycle events. Save the returned `fixture_created_at` and `exact_pause_date`.

### Checkpoint 4: capture the read-only baseline

Run `scripts/verify-pause-e2e-fixture.sql` manually and save every result. Run it again immediately before Pause after the browser has loaded the fixture.

Expected result: `fixture_stage = 'ready'`, `pause_e2e_fixture_state_passed = true`, and an unchanged `non_fixture` fingerprint compared with Checkpoint 2A. The two runs in this checkpoint must also have identical fixture and non-fixture fingerprints. In particular, the dashboard load must not create renewal periods or move `next_renewal_date`. If they differ, stop and clean up without running Pause.

Pause all unrelated use of this Supabase project during the short comparison window. A concurrent legitimate write would change the non-fixture fingerprint and must be treated as an inconclusive safety check, not ignored.

### Checkpoint 5: read-only browser precheck

Sign in as the disposable user. Codex may navigate read-only only after approval to use the newly committed fixture. Verify both relationships, the primary and control histories, and the eligible Pause action. Do not confirm Pause yet.

Expected result: only the primary relationship is selected; both remain Active; Payments and renewal activity match the SQL baseline; no automatic renewal generation occurred.

### Checkpoint 6: execute one UI Pause

Requires separate, action-time explicit approval. In the primary relationship only, use the setup script's `exact_pause_date`, a recognisable reason such as `Phase 2B2-A5 disposable test`, and an optional planned resume date later than the Pause date. Confirm once and wait for the UI refresh.

Expected result: the UI reports success, the primary relationship becomes Paused, Last Billing Setup is read-only, Payments remain, pre/effective unresolved periods remain reviewable, post-effective unresolved periods are excluded, no operational Upcoming remains, and the isolation relationship is unchanged.

### Checkpoint 7: read-only postcheck

Run `scripts/verify-pause-e2e-fixture.sql` again and compare it to the saved baseline.

Expected result: `fixture_stage = 'paused'`, `pause_e2e_fixture_state_passed = true`, exactly one primary `paused` event; primary relationship/component/period changes limited to the expected write set; identical Payment and renewal-activity fingerprints; identical isolation fingerprints; and the same non-fixture fingerprint saved at Checkpoint 2A.

If the non-fixture fingerprint differs, stop. Determine whether a concurrent legitimate write occurred before attributing the difference to Pause.

### Checkpoint 8: browser cross-page verification

Read-only navigation may verify Linked, Subscriptions, Subscription Details, Dashboard, Renewal Decision, Billing Details, Billing History, and Account Activity.

Expected result: one Pause event per activity surface using its effective date and stored metadata, no excluded period in Action Needed, preserved historical review, and no operational paused Upcoming.

### Checkpoint 9: privileged cleanup

Requires explicit approval. Replace the zero UUID in `scripts/cleanup-pause-e2e-fixture.sql`, review the captured ledger and period rows from Checkpoint 7, then run the cleanup manually in Supabase SQL Editor.

The cleanup safety-stops on another owner or an unexpected record. It deletes in this order:

1. exact renewal activity;
2. renewal periods under the two exact relationships/components, including RPC-generated IDs;
3. the captured primary Pause ledger event;
4. the two exact Payments;
5. the three exact billing components;
6. the two exact relationships;
7. the exact tool and logins.

Expected result: the transaction commits only if no public row remains for the test user and no reserved `a034...` public ID remains.

### Checkpoint 10: post-cleanup verification and Auth removal

Run `scripts/verify-pause-e2e-fixture.sql` again. Expected result: `fixture_stage = 'absent'`, `pause_e2e_fixture_state_passed = true`, fixture queries return zero rows, and non-fixture fingerprints match the Checkpoint 2A baseline. Then, with explicit approval, remove the exact disposable Auth user through Supabase Authentication. Do not delete an Auth user until public cleanup has passed.

## Failure and interruption recovery

- Fixture setup failure: the setup transaction rolls back. Re-run the read-only preflight before retrying.
- RPC validation/permission failure: an RPC exception is atomic. Run the verification script. If the relationship remains Active and no lifecycle event exists, either diagnose or clean up; do not mutate rows manually.
- Network ambiguity after Confirm: do not submit a new Pause request. Read the exact relationship and lifecycle ledger first. If the event exists, treat Pause as committed and continue postchecks. The client request UUID is idempotent only for an identical retry from the same mounted modal.
- Browser/app interruption before Pause: run verification, then guarded cleanup. The cleanup permits zero lifecycle events.
- Interruption after Pause: the dedicated user and reserved relationship IDs isolate the partial test. Run verification, save the generated lifecycle/period IDs, then guarded cleanup.
- Unexpected record before cleanup: cleanup aborts and rolls back. Inspect the record and ownership; never widen the delete predicates or disable RLS to force cleanup.
- Auth user removed too early: public fixture parents can remain because not every owner column cascades from `auth.users`. The guarded cleanup accepts an absent Auth row, but still rejects an existing Auth row with a different email and still requires every reserved public row to belong to the supplied UUID. Run that same exact-ID cleanup, then verify. This ordering error should still be avoided.

## Safety conclusion

With a new dedicated Auth user, fixed public IDs, exact ownership guards, a quiet comparison window, future operational renewal dates, saved fingerprints, and privileged fail-closed cleanup, the test does not need to risk an existing user's relationship. It does temporarily create real database test records and intentionally mutates the primary fixture, so fixture creation, the UI Pause, cleanup, and Auth-user removal each remain separately approval-gated.
