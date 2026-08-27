# Billing Domain Rules

Status: Product source of truth for the billing domain.

This document defines the agreed product concepts and rules that future Billing work must follow. It describes intended behaviour; it does not imply that every rule is already implemented.

## Domain boundaries

AI Subprise separates core account tracking from billing management.

Core account tracking owns the relationship between an AI tool and a login/account, including:

- Plan: Free, Trial, or Paid
- optional Plan Name
- relationship Status: Active, On a break, or Goodbye
- login/account identity
- trial lifecycle information
- other non-financial relationship metadata

Billing management owns current financial configuration, expected future billing, and historical payments. Billing setup is optional and must not block creating or saving a Paid relationship.

Plan, Plan Name, Status, and the linked login/account remain core relationship fields. They must not become dependent on access to Billing.

## Core concepts

### Linked relationship

`Linked` represents a current or past relationship between an AI tool and a login/account. The durable identity of that relationship is `tool_email_links.id`.

- Ordinary editing, unlinking, and relinking must preserve the relationship row and durable ID.
- Unlinking records durable relationship state such as `unlinked_at`; it does not destroy the relationship's history.
- Relinking the same tool/account should reactivate the existing relationship when appropriate.
- Current billing configuration, Payments, and Account Activity belong to the exact relationship, not to a tool-name or account-label match.
- Multiple accounts for one tool remain separate relationships.

### Current Billing

**Current Billing** is the account's current billing configuration. It describes how the relationship is billed now; it is not evidence that a payment occurred.

- Only Paid linked relationships appear in Billing.
- A Paid relationship may have no billing configuration.
- Plan Name, Billing Type, Amount, Currency, and relevant billing dates are optional.
- Missing values have no automatic default and must not be invented.
- Missing Billing Type must not be migrated or interpreted as Monthly.
- Current Billing is stored as zero or more independent billing components attached to a linked relationship.
- Multiple billing components may exist on the same relationship.
- Editing Current Billing must not create, rewrite, infer, or delete historical Payments.
- Editing core Tool Detail fields must not overwrite or clear Current Billing.

### Payments

**Payments** are actual historical payment transactions. They are stored independently from Current Billing.

- A Payment belongs to one exact linked relationship.
- A Payment stores its own snapshot of plan name, billing type, amount, currency, payment date, transaction status, and note.
- Changing Current Billing does not change an existing Payment snapshot.
- A future renewal date is not a Payment.
- Payments may be added manually and may be edited or corrected.
- A corrected Payment should eventually display a subtle `Edited` indicator.
- Editing a Payment does not create an Account Activity event.
- Historical Payments default to newest-to-oldest order.
- Migrated or otherwise protected read-only records remain governed by their source rules.

### Upcoming

**Upcoming** represents expected future billing events derived from Current Billing.

- Upcoming events are projections, not payment transactions.
- An Upcoming event does not enter Payments until the user confirms that it was paid.
- Merely opening Billing, Billing History, or Billing Details must not generate an Upcoming event or Payment.
- Current renewal dates remain current-state inputs used to derive Upcoming events.

### Account Activity

**Account Activity** is an append-only lifecycle log for a linked relationship.

Examples include:

- Free → Paid
- Trial → Paid
- Active → Goodbye
- Goodbye → Active
- plan-name or plan changes
- meaningful Current Billing configuration changes

Rules:

- Account Activity is distinct from Payments.
- Existing events are historical facts and are not rewritten when current state changes.
- Events default to newest-to-oldest order.
- Editing or correcting a historical Payment does not create an Account Activity event.
- Routine reads must never create Account Activity events.

## Current billing-type rules

| Billing Type | Amount and Currency | Relevant Date | Meaning |
| --- | --- | --- | --- |
| Monthly | Optional | Next renewal, optional | Recurring monthly configuration |
| Yearly | Optional | Next renewal, optional | Recurring yearly configuration |
| Lifetime | Optional | Purchased On, optional | Non-recurring lifetime purchase configuration |
| One-time payment | Optional | Purchased On, optional | Non-recurring purchase configuration |
| Top-up credit | Optional | Last Topped Up, optional | Credit top-up configuration |

Additional rules:

- Billing Type is optional and has no default.
- Amount and Currency are optional for every Billing Type.
- Only the date field relevant to the Billing Type is used.
- Monthly and Yearly use a future renewal date.
- Lifetime and One-time payment use Purchased On.
- Top-up credit uses Last Topped Up.
- Each billing component retains its own amount, currency, and relevant date.
- Components must not be merged into a summed display such as `Monthly + Top-up · USD 13`.
- Examples such as Monthly + Top-up credit and Yearly + Top-up credit remain separate components on the same relationship.

## Product surfaces

### Tool Detail

Tool Detail manages core relationship identity:

- linked login/account
- Plan
- optional Plan Name
- Status
- trial lifecycle information where applicable
- other non-billing relationship metadata

Tool Detail does not own Billing Type, Amount, Currency, Next Renewal, Purchased On, or Last Topped Up. Saving Tool Detail must preserve existing Current Billing and must not create Payments.

### Billing Overview

Billing Overview is an overview of Paid linked relationships and their Current Billing. It is not a transaction ledger.

### Billing By Month

Billing By Month represents actual historical Payments grouped by payment month. It must not derive historical rows from a future renewal date or from Current Billing alone.

### Billing History drawer

The **Billing History drawer** is a quick, read-only statement for an AI tool.

- It shows Current Billing for each linked Paid account.
- It shows up to the latest five Payments.
- `View X more payments` will eventually navigate to Billing Details.
- For multi-account tools, it may show multiple account sections while keeping Payments relationship-specific.
- Opening the drawer must not create or modify Payments, Current Billing, Upcoming events, relationship IDs, or Account Activity.

### Billing Details page

The **Billing Details page** is the full management destination for an AI tool's billing.

It will support:

- an All Accounts view for multi-account tools
- account-specific views
- Current Billing management
- full Payments management
- Upcoming events
- full Account Activity

For a multi-account tool, the conceptual account navigation is:

`All accounts | Personal · Plus | Work · Pro`

A single-account tool does not need an account selector.

## Historical payment workflows

- Single Payment creates one historical Payment after explicit user confirmation.
- Subscription Period builds a reviewable set of Monthly or Yearly historical Payments before confirmation.
- Generated records remain editable before confirmation.
- Duplicate prevention remains deterministic and relationship-specific.
- The Subscription Period builder action currently known as `+ Add One-off Payment` should be renamed to `+ Add Extra Payment` when that UI is next changed.
- Invoice extraction, when implemented, is transient autofill only: the user reviews the extracted fields before any Payment is created.

## Sorting and display

- Payments default to newest to oldest.
- Account Activity defaults to newest to oldest.
- Current Billing components remain independently visible.
- Missing optional values display an explicit neutral state such as `Not recorded`; they are not silently defaulted.

## Explicitly out of scope

- Currency conversion and base-currency conversion
- Automatic creation of Payments from Current Billing
- Treating Upcoming events as paid without confirmation
- Permanent invoice-file storage as part of the current transient-autofill direction
- Paywall or entitlement behaviour until separately designed

## Integrity invariants

Future Billing work must preserve these invariants:

1. Core linked relationships work independently of Billing.
2. Current Billing, Upcoming, Payments, and Account Activity remain distinct concepts.
3. Every billing record targets an exact durable linked-relationship ID.
4. Current-state edits do not rewrite historical Payment snapshots or existing Account Activity.
5. Read-only navigation never creates financial or lifecycle records.
6. Optional missing billing data remains missing; the application does not guess.
