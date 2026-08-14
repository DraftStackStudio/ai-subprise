import { createClient } from "@/lib/supabase/client";
import type { BillingHistoryEntry } from "@/types/billingHistory";
import type { TrialResolutionHistoryEntry } from "@/types/toolDetail";

export type SupabaseToolStatus = "Active" | "Trial" | "Free Tier" | "Paused" | "Considering" | "Cancelled" | "Paid" | "Free";

export type ToolRecord = {
  accounts: string[];
  archived: boolean;
  archivedAt?: string;
  archivedStatus?: SupabaseToolStatus;
  billing: string;
  category: string;
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
    .order("created_at", { ascending: true });

  if (toolError) throw toolError;

  const { data: links, error: linkError } = await supabase
    .from("tool_email_links")
    .select("tool_id,email_account_id,logins(label)");

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

export async function getToolLinkDetailRecords() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tool_email_links")
    .select("*,logins(label)");

  if (error) throw error;

  return (data ?? []).map((link) => {
    const rawLink = link as Record<string, unknown>;
    const joinedAccount = (link as { logins?: { label?: string } | { label?: string }[] }).logins;
    const account = Array.isArray(joinedAccount) ? joinedAccount[0] : joinedAccount;
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
      billingHistoryEntries,
      billingType: typeof rawLink.billing_type === "string" && rawLink.billing_type ? rawLink.billing_type : "Monthly",
      convertedDate: typeof rawLink.converted_date === "string" ? rawLink.converted_date : "",
      currency: typeof rawLink.currency === "string" && rawLink.currency ? rawLink.currency : "USD",
      lastTopUpDate: typeof rawLink.last_top_up_date === "string" ? rawLink.last_top_up_date : "",
      nextChargeDate: typeof rawLink.next_charge_date === "string" ? rawLink.next_charge_date : "",
      purchaseDate: typeof rawLink.purchase_date === "string" ? rawLink.purchase_date : "",
      startDate: typeof rawLink.start_date === "string" ? rawLink.start_date : "",
      plan: typeof rawLink.plan === "string" && rawLink.plan ? rawLink.plan : "Free Tier",
      planName: typeof rawLink.plan_name === "string" ? rawLink.plan_name : "",
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
  await replaceToolLinks(savedTool.id, input.accounts, accounts);
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
  await replaceToolLinks(id, input.accounts, accounts);
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

export async function deleteToolRecords(ids: string[]) {
  if (ids.length === 0) return;
  const supabase = createClient();
  const { error } = await supabase.from("ai_tools").delete().in("id", ids);
  if (error) throw error;
}

export async function replaceToolLinks(toolId: string, labels: string[], accounts: AccountRef[]) {
  const supabase = createClient();
  const { error: deleteError } = await supabase
    .from("tool_email_links")
    .delete()
    .eq("tool_id", toolId);
  if (deleteError) throw deleteError;

  const selectedAccounts = accountIdsForLabels(accounts, labels);
  if (selectedAccounts.length === 0) return;
  const userId = await currentUserId();

  const { error: insertError } = await supabase.from("tool_email_links").insert(
    selectedAccounts.map((account, index) => ({
      email_account_id: account.id,
      slot_order: index + 1,
      tool_id: toolId,
      user_id: userId,
    })),
  );

  if (insertError) throw insertError;
}

export async function updateToolLinkDetails(
  toolId: string,
  accountLabel: string,
  accounts: AccountRef[],
  details: {
    amount?: string;
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
) {
  const account = accounts.find((item) => item.label === accountLabel);
  if (!account?.id) return;

  const supabase = createClient();
  const payload: Record<string, unknown> = {};

  if (details.amount !== undefined) payload.amount = details.amount || null;
  if (details.billingHistoryEntries !== undefined) payload.billing_history_entries = details.billingHistoryEntries;
  if (details.billingType !== undefined) payload.billing_type = details.billingType || null;
  if (details.convertedDate !== undefined) payload.converted_date = details.convertedDate || null;
  if (details.currency !== undefined) payload.currency = details.currency || "USD";
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

  if (Object.keys(payload).length === 0) return;

  const { error } = await supabase
    .from("tool_email_links")
    .update(payload)
    .eq("tool_id", toolId)
    .eq("email_account_id", account.id);

  if (error) throw error;
}
