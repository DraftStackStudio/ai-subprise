-- Strictly read-only post-migration verification for migration 0030.
-- Normal renewal sync may add later periods and advance Next renewal. Existing
-- billing-correction activity is audit history, so neither has an exact count.

with
expected_columns(table_name, column_name, data_type) as (
  values
    ('tool_link_billing_components', 'retired_at', 'timestamp with time zone'),
    ('billing_renewal_periods', 'excluded_at', 'timestamp with time zone'),
    ('billing_renewal_periods', 'excluded_by_lifecycle_event_id', 'uuid'),
    ('subscription_lifecycle_events', 'id', 'uuid'),
    ('subscription_lifecycle_events', 'user_id', 'uuid'),
    ('subscription_lifecycle_events', 'tool_email_link_id', 'uuid'),
    ('subscription_lifecycle_events', 'previous_lifecycle_state', 'text'),
    ('subscription_lifecycle_events', 'next_lifecycle_state', 'text'),
    ('subscription_lifecycle_events', 'event_kind', 'text'),
    ('subscription_lifecycle_events', 'effective_date', 'date'),
    ('subscription_lifecycle_events', 'effective_date_precision', 'text'),
    ('subscription_lifecycle_events', 'reason', 'text'),
    ('subscription_lifecycle_events', 'planned_resume_date', 'date'),
    ('subscription_lifecycle_events', 'planned_resume_precision', 'text'),
    ('subscription_lifecycle_events', 'previous_billing_component_id', 'uuid'),
    ('subscription_lifecycle_events', 'new_billing_component_id', 'uuid'),
    ('subscription_lifecycle_events', 'plan_name_snapshot', 'text'),
    ('subscription_lifecycle_events', 'previous_plan_name', 'text'),
    ('subscription_lifecycle_events', 'billing_type_snapshot', 'text'),
    ('subscription_lifecycle_events', 'currency_snapshot', 'text'),
    ('subscription_lifecycle_events', 'amount_snapshot', 'numeric'),
    ('subscription_lifecycle_events', 'created_at', 'timestamp with time zone')
),
expected_indexes(index_name) as (
  values
    ('tool_link_billing_components_current_recurring_uidx'),
    ('tool_link_billing_components_non_recurring_uidx'),
    ('subscription_lifecycle_events_relationship_date_idx'),
    ('billing_renewal_periods_reviewable_idx')
),
expected_constraints(constraint_name) as (
  values
    ('tool_link_billing_components_retired_type_check'),
    ('subscription_lifecycle_events_previous_state_check'),
    ('subscription_lifecycle_events_next_state_check'),
    ('subscription_lifecycle_events_kind_check'),
    ('subscription_lifecycle_events_effective_precision_check'),
    ('subscription_lifecycle_events_planned_precision_check'),
    ('subscription_lifecycle_events_planned_pair_check'),
    ('subscription_lifecycle_events_planned_pause_only_check'),
    ('subscription_lifecycle_events_transition_check'),
    ('subscription_lifecycle_events_billing_type_check'),
    ('subscription_lifecycle_events_currency_check'),
    ('subscription_lifecycle_events_amount_check'),
    ('billing_renewal_periods_exclusion_pair_check'),
    ('billing_renewal_periods_resolved_not_excluded_check'),
    ('billing_renewal_periods_excluded_event_fkey')
),
structure as (
  select
    to_regclass('public.subscription_lifecycle_events') is not null as lifecycle_table_exists,
    not exists (
      select 1 from expected_columns as expected
      where not exists (
        select 1 from information_schema.columns as column_info
        where column_info.table_schema = 'public'
          and column_info.table_name = expected.table_name
          and column_info.column_name = expected.column_name
          and column_info.data_type = expected.data_type
      )
    ) as columns_exist,
    not exists (
      select 1 from expected_indexes as expected
      where to_regclass('public.' || expected.index_name) is null
    ) as indexes_exist,
    not exists (
      select 1 from expected_constraints as expected
      where not exists (
        select 1 from pg_constraint as constraint_info
        where constraint_info.conname = expected.constraint_name
      )
    ) as constraints_exist,
    exists (
      select 1 from pg_constraint as constraint_info
      where constraint_info.conname = 'billing_renewal_periods_excluded_event_fkey'
        and constraint_info.condeferrable
        and constraint_info.condeferred
    ) as exclusion_foreign_key_is_deferred
),
classification as (
  select
    count(*) filter (
      where component.billing_type in ('Monthly', 'Yearly')
        and component.retired_at is null
        and (
          link.unlinked_at is not null
          or link.status in (
            'Paused', 'On a Break', 'On a break', 'Goodbye',
            'Goodbye it was a journey', 'Goodbye, it was a journey'
          )
        )
    ) as mismatch_count,
    count(*) filter (
      where component.billing_type not in ('Monthly', 'Yearly')
        and component.retired_at is not null
    ) as invalid_non_recurring_retirement_count
  from public.tool_link_billing_components as component
  join public.tool_email_links as link on link.id = component.tool_email_link_id
),
current_recurring_conflicts as (
  select count(*) as conflict_count
  from (
    select component.tool_email_link_id
    from public.tool_link_billing_components as component
    where component.billing_type in ('Monthly', 'Yearly')
      and component.retired_at is null
    group by component.tool_email_link_id
    having count(*) > 1
  ) as conflicts
),
non_recurring_conflicts as (
  select count(*) as conflict_count
  from (
    select component.tool_email_link_id, component.billing_type
    from public.tool_link_billing_components as component
    where component.billing_type in ('Lifetime', 'One-time', 'Top-up')
    group by component.tool_email_link_id, component.billing_type
    having count(*) > 1
  ) as conflicts
),
ledger as (
  select
    (select count(*) from public.subscription_lifecycle_events) as lifecycle_event_count,
    (
      select count(*) from public.billing_renewal_periods as period
      where period.excluded_at is not null
         or period.excluded_by_lifecycle_event_id is not null
    ) as excluded_period_count
),
permissions as (
  select
    exists (
      select 1 from pg_class as relation
      join pg_namespace as namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = 'subscription_lifecycle_events'
        and relation.relrowsecurity
    )
    and exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'subscription_lifecycle_events'
        and policyname = 'subscription_lifecycle_events_owner_select'
        and cmd = 'SELECT'
        and coalesce(qual, '') like '%auth.uid()%'
        and coalesce(qual, '') like '%user_id%'
    )
    and has_table_privilege('authenticated', 'public.subscription_lifecycle_events', 'SELECT')
    and not has_table_privilege('authenticated', 'public.subscription_lifecycle_events', 'INSERT')
    and not has_table_privilege('authenticated', 'public.subscription_lifecycle_events', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.subscription_lifecycle_events', 'DELETE')
    and not has_table_privilege('anon', 'public.subscription_lifecycle_events', 'SELECT')
    and not has_table_privilege('anon', 'public.subscription_lifecycle_events', 'INSERT')
    and not has_table_privilege('anon', 'public.subscription_lifecycle_events', 'UPDATE')
    and not has_table_privilege('anon', 'public.subscription_lifecycle_events', 'DELETE')
    and not exists (
      select 1
      from pg_class as relation
      join pg_namespace as namespace on namespace.oid = relation.relnamespace
      cross join lateral aclexplode(
        coalesce(relation.relacl, acldefault('r', relation.relowner))
      ) as privilege
      where namespace.nspname = 'public'
        and relation.relname = 'subscription_lifecycle_events'
        and privilege.grantee = 0
        and privilege.privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
    )
    as contract_passed
),
rpc_contracts as (
  select
    not has_function_privilege(
      'authenticated', 'public.recalculate_billing_next_renewal(uuid,uuid)', 'EXECUTE'
    )
    and has_function_privilege(
      'authenticated', 'public.sync_due_billing_renewal_periods(uuid,uuid,date)', 'EXECUTE'
    )
    and has_function_privilege(
      'authenticated', 'public.confirm_billing_renewal_paid(uuid,uuid)', 'EXECUTE'
    )
    and has_function_privilege(
      'authenticated',
      'public.mark_billing_renewal_not_charged(uuid,uuid,text,text,text)', 'EXECUTE'
    )
    and has_function_privilege(
      'authenticated',
      'public.update_billing_renewal_period_snapshot(uuid,uuid,text,text,numeric,date,text,date)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'anon', 'public.recalculate_billing_next_renewal(uuid,uuid)', 'EXECUTE'
    )
    and not has_function_privilege(
      'anon', 'public.sync_due_billing_renewal_periods(uuid,uuid,date)', 'EXECUTE'
    )
    and not has_function_privilege(
      'anon', 'public.confirm_billing_renewal_paid(uuid,uuid)', 'EXECUTE'
    )
    and not has_function_privilege(
      'anon',
      'public.mark_billing_renewal_not_charged(uuid,uuid,text,text,text)', 'EXECUTE'
    )
    and not has_function_privilege(
      'anon',
      'public.update_billing_renewal_period_snapshot(uuid,uuid,text,text,numeric,date,text,date)',
      'EXECUTE'
    )
    and coalesce(lower(pg_get_functiondef(to_regprocedure(
      'public.recalculate_billing_next_renewal(uuid,uuid)'
    ))) like '%v_retired_at%', false)
    and coalesce(lower(pg_get_functiondef(to_regprocedure(
      'public.sync_due_billing_renewal_periods(uuid,uuid,date)'
    ))) like '%component.retired_at is null%', false)
    and coalesce(lower(pg_get_functiondef(to_regprocedure(
      'public.confirm_billing_renewal_paid(uuid,uuid)'
    ))) like '%period.excluded_at is null%', false)
    and coalesce(lower(pg_get_functiondef(to_regprocedure(
      'public.mark_billing_renewal_not_charged(uuid,uuid,text,text,text)'
    ))) like '%period.excluded_at is null%', false)
    and coalesce(lower(pg_get_functiondef(to_regprocedure(
      'public.update_billing_renewal_period_snapshot(uuid,uuid,text,text,numeric,date,text,date)'
    ))) like '%period.excluded_at is null%', false)
    and coalesce(lower(pg_get_functiondef(to_regprocedure(
      'public.update_billing_renewal_period_snapshot(uuid,uuid,text,text,numeric,date,text,date)'
    ))) like '%v_component_retired_at is null%', false)
    and coalesce(lower(pg_get_functiondef(to_regprocedure(
      'public.update_billing_renewal_period_snapshot(uuid,uuid,text,text,numeric,date,text,date)'
    ))) like '%component.retired_at is null%', false)
    as contract_passed
),
baseline as (
  select
    (select count(*) from public.tool_email_links) as relationship_count,
    (select count(*) from public.tool_link_billing_components) as component_count,
    (select count(*) from public.billing_transactions) as payment_count,
    (select count(*) from public.billing_renewal_periods) as renewal_period_count,
    (select count(*) from public.billing_renewal_activity) as renewal_activity_count
),
required_retained_dates(scheduled_date) as (
  values
    (date '2026-01-31'), (date '2026-02-28'), (date '2026-03-31'),
    (date '2026-04-30'), (date '2026-05-31'), (date '2026-06-30'),
    (date '2026-07-31'), (date '2026-08-31')
),
retained as (
  select
    exists (
      select 1 from public.tool_email_links as link
      where link.id = 'a0270000-0000-0000-0000-000000000301'::uuid
        and link.unlinked_at is null
        and link.status = 'Active'
    ) as relationship_exists,
    exists (
      select 1 from public.tool_link_billing_components as component
      where component.tool_email_link_id = 'a0270000-0000-0000-0000-000000000301'::uuid
        and component.billing_type = 'Monthly'
        and component.currency = 'SGD'
        and nullif(btrim(component.amount), '')::numeric = 30.84
        and component.recurrence_anchor_date is not null
        and component.next_renewal_date is not null
        and component.retired_at is null
        and component.next_renewal_date = (
          select link.next_charge_date from public.tool_email_links as link
          where link.id = component.tool_email_link_id
        )
        and component.next_renewal_date > coalesce((
          select max(period.scheduled_renewal_date)
          from public.billing_renewal_periods as period
          where period.tool_email_link_id = component.tool_email_link_id
        ), date '2026-08-31')
        and (
          (extract(year from component.next_renewal_date)::integer
            - extract(year from component.recurrence_anchor_date)::integer) * 12
          + extract(month from component.next_renewal_date)::integer
          - extract(month from component.recurrence_anchor_date)::integer
        ) >= 0
        and component.next_renewal_date = make_date(
          extract(year from component.next_renewal_date)::integer,
          extract(month from component.next_renewal_date)::integer,
          least(
            extract(day from component.recurrence_anchor_date)::integer,
            extract(day from (
              date_trunc('month', component.next_renewal_date)
              + interval '1 month - 1 day'
            ))::integer
          )
        )
    ) as current_billing_progression_is_consistent,
    not exists (
      select 1 from required_retained_dates as required
      where not exists (
        select 1 from public.billing_renewal_periods as period
        where period.tool_email_link_id = 'a0270000-0000-0000-0000-000000000301'::uuid
          and period.scheduled_renewal_date = required.scheduled_date
          and period.billing_date = required.scheduled_date
          and period.resolution is null
          and period.excluded_at is null
          and period.excluded_by_lifecycle_event_id is null
      )
    ) as jan_aug_baseline_preserved,
    not exists (
      select 1 from public.billing_transactions as payment
      where payment.tool_email_link_id = 'a0270000-0000-0000-0000-000000000301'::uuid
        and payment.source = 'renewal'
    ) as zero_renewal_payments,
    not exists (
      select 1 from public.billing_renewal_activity as activity
      left join public.billing_renewal_periods as period
        on period.id = activity.billing_renewal_period_id
      where activity.tool_email_link_id = 'a0270000-0000-0000-0000-000000000301'::uuid
        and (
          activity.kind not in ('billing_period_corrected', 'billing_schedule_changed')
          or period.id is null
          or period.tool_email_link_id <> activity.tool_email_link_id
        )
    ) as audit_history_is_valid
)
select
  structure.lifecycle_table_exists,
  structure.columns_exist,
  structure.indexes_exist,
  structure.constraints_exist,
  structure.exclusion_foreign_key_is_deferred,
  classification.mismatch_count as classification_mismatch_count,
  classification.invalid_non_recurring_retirement_count,
  current_recurring_conflicts.conflict_count as current_recurring_conflict_count,
  non_recurring_conflicts.conflict_count as non_recurring_conflict_count,
  ledger.lifecycle_event_count,
  ledger.excluded_period_count,
  permissions.contract_passed as lifecycle_permission_contract_passed,
  rpc_contracts.contract_passed as protected_rpc_contract_passed,
  baseline.relationship_count,
  baseline.component_count,
  baseline.payment_count,
  baseline.renewal_period_count,
  baseline.renewal_activity_count,
  retained.relationship_exists as retained_relationship_exists,
  retained.current_billing_progression_is_consistent,
  retained.jan_aug_baseline_preserved,
  retained.zero_renewal_payments as retained_zero_renewal_payments,
  retained.audit_history_is_valid as retained_audit_history_is_valid,
  (
    structure.lifecycle_table_exists
    and structure.columns_exist
    and structure.indexes_exist
    and structure.constraints_exist
    and structure.exclusion_foreign_key_is_deferred
    and classification.mismatch_count = 0
    and classification.invalid_non_recurring_retirement_count = 0
    and current_recurring_conflicts.conflict_count = 0
    and non_recurring_conflicts.conflict_count = 0
    and ledger.lifecycle_event_count = 0
    and ledger.excluded_period_count = 0
    and permissions.contract_passed
    and rpc_contracts.contract_passed
    and baseline.relationship_count >= 51
    and baseline.component_count >= 7
    and baseline.payment_count >= 15
    and baseline.renewal_period_count >= 8
    and retained.relationship_exists
    and retained.current_billing_progression_is_consistent
    and retained.jan_aug_baseline_preserved
    and retained.zero_renewal_payments
    and retained.audit_history_is_valid
  ) as migration_0030_postcheck_passed
from structure
cross join classification
cross join current_recurring_conflicts
cross join non_recurring_conflicts
cross join ledger
cross join permissions
cross join rpc_contracts
cross join baseline
cross join retained;
