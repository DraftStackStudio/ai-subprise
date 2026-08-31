import { createClient } from "@/lib/supabase/client";
import type { BillingHistoryEntry } from "@/types/billingHistory";
import type { BillingAmount, TrialResolutionHistoryEntry } from "@/types/toolDetail";

export type SupabaseToolStatus = "Active" | "Trial" | "Free Tier" | "Paused" | "Considering" | "Cancelled" | "Paid" | "Free";

export type ToolRecord = {
  accounts: string[];
  archived: boolean;
  archivedAt?: string;
  archivedStatus?: SupabaseToolStatus;
  billing: string;
  category: string;
  deletedAt?: string;
  favorite: boolean;
  id: string;
  logo: string;
  logoBg: string;
  name: string;
  notes: string;
  restoredAt?: string;
  status: SupabaseToolStatus;
  url: string;
};

export type ToolInput = Omit<ToolRecord, "id"> & { id?: string };

export type AccountRef = {
  id?: string;
  label: string;
};

function toolInitials(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "AI";
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

function asToolRecord(record: Record<string, unknown>, accounts: string[]): ToolRecord {
  const name = String(record.name ?? "");

  return {
    accounts,
    archived: Boolean(record.is_archived),
    archivedAt: typeof record.archived_at === "string" ? record.archived_at : undefined,
    archivedStatus: typeof record.archived_status === "string" ? record.archived_status as SupabaseToolStatus : undefined,
    billing: typeof record.billing_type === "string" && record.billing_type ? record.billing_type : "None",
    category: typeof record.category === "string" ? record.category : "Uncategorized",
    deletedAt: typeof record.deleted_at === "string" ? record.deleted_at : undefined,
    favorite: Boolean(record.is_favourite),
    id: String(record.id),
    logo: typeof record.logo_text === "string" && record.logo_text ? record.logo_text : toolInitials(name),
    logoBg: typeof record.logo_bg === "string" && record.logo_bg ? record.logo_bg : "#F0F4FF",
    name,
    notes: typeof record.notes === "string" ? record.notes : "",
    restoredAt: typeof record.restored_at === "string" ? record.restored_at : undefined,
    status: typeof record.status === "string" ? record.status as SupabaseToolStatus : "Free Tier",
    url: typeof record.url === "string" ? record.url : "",
  };
}

function toolPayload(input: ToolInput) {
  return {
    archived_at: input.archivedAt ?? null,
    archived_status: input.archivedStatus ?? null,
    billing_type: input.billing,
    category: input.category,
    is_archived: input.archived,
    is_favourite: input.favorite,
    logo_bg: input.logoBg,
    logo_text: input.logo,
    name: input.name,
    notes: input.notes,
    restored_at: input.restoredAt ?? null,
    status: input.status,
    url: input.url || null,
  };
}

function accountIdsForLabels(accounts: AccountRef[], labels: string[]) {
  const selectedLabels = new Set(labels);
  return accounts.filter((account) => account.id && selectedLabels.has(account.label));
}

async function currentUserId() {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;
  if (!user) throw new Error("Please sign in before saving AI tool data.");

  return user.id;
}

export async function getToolRecords() {
  const supabase = createClient();

  const { data: tools, error: toolError } = await supabase
    .from("ai_tools")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (toolError) throw toolError;

  const { data: links, error: linkError } = await supabase
    .from("tool_email_links")
    .select("tool_id,email_account_id,logins(label)")
    .is("unlinked_at", null);

  if (linkError) throw linkError;

  const labelsByToolId = new Map<string, string[]>();
  (links ?? []).forEach((link) => {
    const toolId = String((link as Record<string, unknown>).tool_id ?? "");
    const joinedAccount = (link as { logins?: { label?: string } | { label?: string }[] }).logins;
    const account = Array.isArray(joinedAccount) ? joinedAccount[0] : joinedAccount;
    const label = account?.label;
    if (!toolId || !label) return;
    labelsByToolId.set(toolId, [...(labelsByToolId.get(toolId) ?? []), label]);
  });

  return (tools ?? []).map((tool) => asToolRecord(tool as Record<string, unknown>, labelsByToolId.get(String((tool as Record<string, unknown>).id)) ?? []));
}

export async function getDeletedToolRecords() {
  const supabase = createClient();

  const { data: tools, error: toolError } = await supabase
    .from("ai_tools")
    .select("*")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  if (toolError) throw toolError;

  const toolIds = (tools ?? []).map((tool) => String((tool as Record<string, unknown>).id));
  if (toolIds.length === 0) return [];

  const { data: links, error: linkError } = await supabase
    .from("tool_email_links")
    .select("tool_id,email_account_id,logins(label)")
    .in("tool_id", toolIds);

  if (linkError) throw linkError;

  const labelsByToolId = new Map<string, string[]>();
  (links ?? []).forEach((link) => {
    const toolId = String((link as Record<string, unknown>).tool_id ?? "");
    const joinedAccount = (link as { logins?: { label?: string } | { label?: string }[] }).logins;
    const account = Array.isArray(joinedAccount) ? joinedAccount[0] : joinedAccount;
    const label = account?.label;
    if (!toolId || !label) return;
    const labels = labelsByToolId.get(toolId) ?? [];
    if (!labels.includes(label)) labelsByToolId.set(toolId, [...labels, label]);
  });

  return (tools ?? []).map((tool) => {
    const rawTool = tool as Record<string, unknown>;
    return asToolRecord(rawTool, labelsByToolId.get(String(rawTool.id)) ?? []);
  });
}

export async function getToolLinkDetailRecords(options: { includeUnlinked?: boolean } = {}) {
  const supabase = createClient();
  const currentQuery = supabase
    .from("tool_email_links")
    .select("*,logins(label),tool_link_billing_components(*)");
  let { data, error } = options.includeUnlinked
    ? await currentQuery
    : await currentQuery.is("unlinked_at", null);

  // Keep the current app usable while migration 0022 is being deployed.
  if (error) {
    const legacyQuery = supabase
      .from("tool_email_links")
      .select("*,logins(label)");
    const legacyResult = options.includeUnlinked
      ? await legacyQuery
      : await legacyQuery.is("unlinked_at", null);
    data = legacyResult.data;
    error = legacyResult.error;
  }

  if (error) throw error;

  return (data ?? []).map((link) => {
    const rawLink = link as Record<string, unknown>;
    const joinedAccount = (link as { logins?: { label?: string } | { label?: string }[] }).logins;
    const account = Array.isArray(joinedAccount) ? joinedAccount[0] : joinedAccount;
    const rawComponents = Array.isArray(rawLink.tool_link_billing_components)
      ? rawLink.tool_link_billing_components
      : [];
    const billingAmounts = rawComponents
      .filter((component): component is Record<string, unknown> => Boolean(component) && typeof component === "object")
      .map((component): BillingAmount => ({
        amount: typeof component.amount === "string" ? component.amount : "",
        billingType: typeof component.billing_type === "string" ? component.billing_type : "",
        currency: typeof component.currency === "string" ? component.currency : "",
        id: String(component.id ?? crypto.randomUUID()),
        lastTopUpDate: typeof component.last_top_up_date === "string" ? component.last_top_up_date : "",
        nextRenewalDate: typeof component.next_renewal_date === "string" ? component.next_renewal_date : "",
        purchaseDate: typeof component.purchase_date === "string" ? component.purchase_date : "",
      }))
      .filter((component) => component.billingType);
    const componentBillingType = billingAmounts.map((component) => component.billingType).join(", ");
    const recurringComponent = billingAmounts.find((component) =>
      component.billingType === "Monthly" || component.billingType === "Yearly");
    const purchaseComponent = billingAmounts.find((component) =>
      component.billingType === "Lifetime" || component.billingType === "One-time");
    const topUpComponent = billingAmounts.find((component) => component.billingType === "Top-up");
    const billingHistoryEntries = Array.isArray(rawLink.billing_history_entries)
      ? rawLink.billing_history_entries
          .filter((entry): entry is BillingHistoryEntry => Boolean(entry) && typeof entry === "object")
      : [];
    const trialResolutionHistory = Array.isArray(rawLink.trial_resolution_history)
      ? rawLink.trial_resolution_history
          .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
          .filter((entry) => entry.outcome === "converted" || entry.outcome === "ended")
          .map((entry): TrialResolutionHistoryEntry => ({
            billingType: typeof entry.billingType === "string" ? entry.billingType : "",
            convertedDate: typeof entry.convertedDate === "string" ? entry.convertedDate : "",
            id: typeof entry.id === "string" ? entry.id : crypto.randomUUID(),
            isCorrection: entry.isCorrection === true,
            nextChargeDate: typeof entry.nextChargeDate === "string" ? entry.nextChargeDate : "",
            purchaseDate: typeof entry.purchaseDate === "string" ? entry.purchaseDate : "",
            outcome: entry.outcome as "converted" | "ended",
            planName: typeof entry.planName === "string" ? entry.planName : "",
          }))
      : [];

    return {
      accountLabel: account?.label ?? "",
      amount: typeof rawLink.amount === "string" ? rawLink.amount : "",
      billingAmounts,
      billingHistoryEntries,
      billingType: componentBillingType || (typeof rawLink.billing_type === "string" ? rawLink.billing_type : ""),
      convertedDate: typeof rawLink.converted_date === "string" ? rawLink.converted_date : "",
      currency: typeof rawLink.currency === "string" && rawLink.currency ? rawLink.currency : "USD",
      lastTopUpDate: topUpComponent?.lastTopUpDate || (typeof rawLink.last_top_up_date === "string" ? rawLink.last_top_up_date : ""),
      nextChargeDate: recurringComponent?.nextRenewalDate || (typeof rawLink.next_charge_date === "string" ? rawLink.next_charge_date : ""),
      purchaseDate: purchaseComponent?.purchaseDate || (typeof rawLink.purchase_date === "string" ? rawLink.purchase_date : ""),
      startDate: typeof rawLink.start_date === "string" ? rawLink.start_date : "",
      plan: typeof rawLink.plan === "string" && rawLink.plan ? rawLink.plan : "Free Tier",
      planName: typeof rawLink.plan_name === "string" ? rawLink.plan_name : "",
      relationshipId: String(rawLink.id ?? ""),
      status: typeof rawLink.status === "string" && rawLink.status ? rawLink.status : "Active",
      toolId: String(rawLink.tool_id ?? ""),
      trialExpiryDate: typeof rawLink.trial_expiry_date === "string" ? rawLink.trial_expiry_date : "",
      trialResolution: (
        rawLink.trial_resolution === "converted" || rawLink.trial_resolution === "ended"
          ? rawLink.trial_resolution
          : ""
      ) as "" | "converted" | "ended",
      trialResolutionHistory,
      trialResolved: rawLink.trial_resolved === true,
      unlinkedAt: typeof rawLink.unlinked_at === "string" ? rawLink.unlinked_at : "",
    };
  }).filter((link) => link.toolId && link.accountLabel);
}

export async function createToolRecord(input: ToolInput, accounts: AccountRef[]) {
  const supabase = createClient();
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("ai_tools")
    .insert({ ...toolPayload(input), user_id: userId })
    .select("*")
    .single();

  if (error) throw error;

  const savedTool = asToolRecord(data as Record<string, unknown>, []);
  await syncToolLinks(savedTool.id, input.accounts, accounts);
  return { ...savedTool, accounts: input.accounts };
}

export async function updateToolRecord(id: string, input: ToolInput, accounts: AccountRef[]) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("ai_tools")
    .update(toolPayload(input))
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;

  const savedTool = asToolRecord(data as Record<string, unknown>, []);
  await syncToolLinks(id, input.accounts, accounts);
  return { ...savedTool, accounts: input.accounts };
}

export async function patchToolRecord(id: string, input: Partial<ToolInput>) {
  const supabase = createClient();
  const payload: Record<string, unknown> = {};

  if (input.archived !== undefined) payload.is_archived = input.archived;
  if (input.archivedAt !== undefined) payload.archived_at = input.archivedAt ?? null;
  if (input.archivedStatus !== undefined) payload.archived_status = input.archivedStatus ?? null;
  if (input.category !== undefined) payload.category = input.category;
  if (input.favorite !== undefined) payload.is_favourite = input.favorite;
  if (input.logo !== undefined) payload.logo_text = input.logo;
  if (input.name !== undefined) payload.name = input.name;
  if (input.notes !== undefined) payload.notes = input.notes;
  if (input.restoredAt !== undefined) payload.restored_at = input.restoredAt ?? null;
  if (input.status !== undefined) payload.status = input.status;
  if (input.url !== undefined) payload.url = input.url || null;

  const { error } = await supabase.from("ai_tools").update(payload).eq("id", id);
  if (error) throw error;
}

export async function softDeleteToolRecords(ids: string[]) {
  if (ids.length === 0) return;
  const supabase = createClient();
  const { error } = await supabase.rpc("soft_delete_ai_tools", { target_tool_ids: ids });
  if (error) throw error;
}

export async function restoreToolRecord(id: string, name?: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("restore_ai_tool", {
    restored_name: name?.trim() || null,
    target_tool_id: id,
  });
  if (error) throw error;
}

export async function permanentlyDeleteToolRecords(ids: string[]) {
  if (ids.length === 0) return;
  const supabase = createClient();
  const { error } = await supabase.from("ai_tools").delete().in("id", ids);
  if (error) throw error;
}

export async function syncToolLinks(toolId: string, labels: string[], accounts: AccountRef[]) {
  const supabase = createClient();
  const selectedAccounts = accountIdsForLabels(accounts, labels);
  const desiredAccountIds = new Set(selectedAccounts.map((account) => account.id));
  const { data: existingLinks, error: selectError } = await supabase
    .from("tool_email_links")
    .select("id,email_account_id,slot_order,unlinked_at,created_at")
    .eq("tool_id", toolId)
    .order("created_at", { ascending: false });
  if (selectError) throw selectError;

  const links = (existingLinks ?? []).map((link) => ({
    emailAccountId: String((link as Record<string, unknown>).email_account_id ?? ""),
    id: String((link as Record<string, unknown>).id ?? ""),
    slotOrder: Number((link as Record<string, unknown>).slot_order ?? 0),
    unlinkedAt: typeof (link as Record<string, unknown>).unlinked_at === "string"
      ? String((link as Record<string, unknown>).unlinked_at)
      : null,
  }));
  const activeLinks = links.filter((link) => !link.unlinkedAt);
  const unlinkedAt = new Date().toISOString();
  const relationshipIdsByLabel: Record<string, string> = {};

  const linksToUnlink = activeLinks.filter((link) => !desiredAccountIds.has(link.emailAccountId));
  if (linksToUnlink.length > 0) {
    const { error } = await supabase
      .from("tool_email_links")
      .update({ unlinked_at: unlinkedAt })
      .in("id", linksToUnlink.map((link) => link.id));
    if (error) throw error;
  }

  const userId = selectedAccounts.length > 0 ? await currentUserId() : "";
  for (const [index, account] of selectedAccounts.entries()) {
    const slotOrder = index + 1;
    const activeLink = activeLinks.find((link) => link.emailAccountId === account.id);
    if (activeLink) {
      if (activeLink.slotOrder !== slotOrder) {
        const { error } = await supabase
          .from("tool_email_links")
          .update({ slot_order: slotOrder })
          .eq("id", activeLink.id);
        if (error) throw error;
      }
      relationshipIdsByLabel[account.label] = activeLink.id;
      continue;
    }

    const historicalLink = links.find((link) => link.emailAccountId === account.id && link.unlinkedAt);
    if (historicalLink) {
      const { error } = await supabase
        .from("tool_email_links")
        .update({ slot_order: slotOrder, unlinked_at: null })
        .eq("id", historicalLink.id);
      if (error) throw error;
      relationshipIdsByLabel[account.label] = historicalLink.id;
      continue;
    }

    const { data: insertedLink, error } = await supabase
      .from("tool_email_links")
      .insert({
        email_account_id: account.id,
        slot_order: slotOrder,
        tool_id: toolId,
        user_id: userId,
      })
      .select("id")
      .single();
    if (error) throw error;
    relationshipIdsByLabel[account.label] = String(insertedLink.id);
  }

  return relationshipIdsByLabel;
}

export async function updateToolLinkDetails(
  toolId: string,
  accountLabel: string,
  accounts: AccountRef[],
  details: {
    amount?: string;
    billingAmounts?: BillingAmount[];
    billingHistoryEntries?: BillingHistoryEntry[];
    billingType?: string;
    convertedDate?: string;
    currency?: string;
    lastTopUpDate?: string;
    nextChargeDate?: string;
    purchaseDate?: string;
    startDate?: string;
    plan?: string;
    planName?: string;
    status?: string;
    trialExpiryDate?: string;
    trialResolution?: "" | "converted" | "ended";
    trialResolutionHistory?: TrialResolutionHistoryEntry[];
    trialResolved?: boolean;
  },
  options?: { expectedRelationshipId: string },
) {
  const account = accounts.find((item) => item.label === accountLabel);
  if (!account?.id && options) throw new Error("The account could not be identified. Reopen Billing Details before saving.");
  if (!account?.id) return;

  const supabase = createClient();
  const payload: Record<string, unknown> = {};

  if (details.amount !== undefined) payload.amount = details.amount || null;
  if (details.billingHistoryEntries !== undefined) payload.billing_history_entries = details.billingHistoryEntries;
  if (details.billingType !== undefined) payload.billing_type = details.billingType || null;
  if (details.convertedDate !== undefined) payload.converted_date = details.convertedDate || null;
  if (details.currency) payload.currency = details.currency;
  if (details.lastTopUpDate !== undefined) payload.last_top_up_date = details.lastTopUpDate || null;
  if (details.nextChargeDate !== undefined) payload.next_charge_date = details.nextChargeDate || null;
  if (details.purchaseDate !== undefined) payload.purchase_date = details.purchaseDate || null;
  if (details.startDate !== undefined) payload.start_date = details.startDate || null;
  if (details.plan !== undefined) payload.plan = details.plan;
  if (details.planName !== undefined) payload.plan_name = details.planName || null;
  if (details.status !== undefined) payload.status = details.status;
  if (details.trialExpiryDate !== undefined) payload.trial_expiry_date = details.trialExpiryDate || null;
  if (details.trialResolution !== undefined) payload.trial_resolution = details.trialResolution || null;
  if (details.trialResolutionHistory !== undefined) payload.trial_resolution_history = details.trialResolutionHistory;
  if (details.trialResolved !== undefined) payload.trial_resolved = details.trialResolved;

  const { data: activeLink, error: linkError } = await supabase
    .from("tool_email_links")
    .select("id")
    .eq("tool_id", toolId)
    .eq("email_account_id", account.id)
    .is("unlinked_at", null)
    .maybeSingle();

  if (linkError) throw linkError;
  if (options && activeLink?.id !== options.expectedRelationshipId) {
    throw new Error("The relationship changed or is no longer linked. Reopen Billing Details before saving.");
  }
  if (!activeLink) return;

  if (Object.keys(payload).length > 0) {
    const { error } = await supabase
      .from("tool_email_links")
      .update(payload)
      .eq("id", activeLink.id);

    if (error) throw error;
  }

  if (details.billingAmounts !== undefined) {
    const components = details.billingAmounts
      .filter((component) => component.billingType)
      .map((component) => {
        const billingType = component.billingType;
        const isRecurring = billingType === "Monthly" || billingType === "Yearly";
        const isPurchase = billingType === "Lifetime" || billingType === "One-time";
        const isTopUp = billingType === "Top-up";
        return {
          amount: component.amount.trim() || null,
          billing_type: billingType,
          currency: component.currency.trim().toUpperCase() || null,
          last_top_up_date: isTopUp
            ? component.lastTopUpDate || details.lastTopUpDate || null
            : null,
          next_renewal_date: isRecurring
            ? component.nextRenewalDate || details.nextChargeDate || null
            : null,
          purchase_date: isPurchase
            ? component.purchaseDate || details.purchaseDate || null
            : null,
          tool_email_link_id: String(activeLink.id),
        };
      });
    const selectedTypes = components.map((component) => component.billing_type);

    if (components.length > 0) {
      const { error } = await supabase
        .from("tool_link_billing_components")
        .upsert(components, { onConflict: "tool_email_link_id,billing_type" });
      if (error) throw error;
    }

    let deleteQuery = supabase
      .from("tool_link_billing_components")
      .delete()
      .eq("tool_email_link_id", activeLink.id);
    if (selectedTypes.length > 0) {
      deleteQuery = deleteQuery.not(
        "billing_type",
        "in",
        `(${selectedTypes.map((billingType) => JSON.stringify(billingType)).join(",")})`,
      );
    }
    const { error } = await deleteQuery;
    if (error) throw error;
  }
}
