import { createClient } from "@/lib/supabase/client";
import type {
  BillingTransaction,
  BillingTransactionSource,
  BillingTransactionStatus,
  BillingTransactionType,
  CreateBillingTransactionInput,
  UpdateBillingTransactionInput,
} from "@/types/billingTransaction";

type RelationshipSnapshot = {
  accountLabel: string;
  accountLogin: string;
  loginId: string;
  toolId: string;
  toolName: string;
};

function optionalText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function optionalCurrency(value?: string) {
  const currency = value?.trim().toUpperCase() ?? "";
  if (currency && !/^[A-Z]{3}$/.test(currency)) {
    throw new Error("Currency must be a three-letter ISO code.");
  }
  return currency;
}

function optionalAmount(value?: string) {
  const amount = value?.trim() ?? "";
  if (amount && !/^\d+(\.\d+)?$/.test(amount)) {
    throw new Error("Transaction amount must be zero or greater.");
  }
  return amount;
}

function asBillingTransaction(record: Record<string, unknown>): BillingTransaction {
  return {
    accountLabelSnapshot: optionalText(record.account_label_snapshot),
    accountLoginSnapshot: optionalText(record.account_login_snapshot),
    amount: record.amount === null || record.amount === undefined ? "" : String(record.amount),
    billingTypeSnapshot: optionalText(record.billing_type_snapshot) as BillingTransactionType | "",
    createdAt: optionalText(record.created_at),
    currency: optionalText(record.currency),
    id: String(record.id ?? ""),
    loginId: optionalText(record.login_id),
    note: optionalText(record.note),
    paymentDate: optionalText(record.payment_date),
    planNameSnapshot: optionalText(record.plan_name_snapshot),
    relationshipId: optionalText(record.tool_email_link_id),
    source: optionalText(record.source) as BillingTransactionSource,
    sourceKey: optionalText(record.source_key),
    status: optionalText(record.status) as BillingTransactionStatus,
    toolId: optionalText(record.tool_id),
    toolNameSnapshot: optionalText(record.tool_name_snapshot),
    updatedAt: optionalText(record.updated_at),
    userId: optionalText(record.user_id),
  };
}

async function currentUserId() {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;
  if (!user) throw new Error("Please sign in before saving billing transactions.");
  return user.id;
}

async function relationshipSnapshot(relationshipId: string): Promise<RelationshipSnapshot> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tool_email_links")
    .select("tool_id,email_account_id,ai_tools(name),logins(label,email_address)")
    .eq("id", relationshipId)
    .single();

  if (error) throw error;
  const raw = data as Record<string, unknown>;
  const joinedTool = raw.ai_tools as { name?: string } | { name?: string }[] | null;
  const joinedLogin = raw.logins as { email_address?: string; label?: string } | { email_address?: string; label?: string }[] | null;
  const tool = Array.isArray(joinedTool) ? joinedTool[0] : joinedTool;
  const login = Array.isArray(joinedLogin) ? joinedLogin[0] : joinedLogin;

  return {
    accountLabel: login?.label ?? "",
    accountLogin: login?.email_address ?? "",
    loginId: optionalText(raw.email_account_id),
    toolId: optionalText(raw.tool_id),
    toolName: tool?.name ?? "",
  };
}

export async function createBillingTransaction(input: CreateBillingTransactionInput) {
  const supabase = createClient();
  const userId = await currentUserId();
  const snapshot = input.relationshipId ? await relationshipSnapshot(input.relationshipId) : null;
  const payload = {
    account_label_snapshot: snapshot?.accountLabel || input.accountLabelSnapshot?.trim() || null,
    account_login_snapshot: snapshot?.accountLogin || input.accountLoginSnapshot?.trim() || null,
    amount: optionalAmount(input.amount) || null,
    billing_type_snapshot: input.billingTypeSnapshot || null,
    currency: optionalCurrency(input.currency) || null,
    login_id: snapshot?.loginId || input.loginId || null,
    note: input.note?.trim() || null,
    payment_date: input.paymentDate,
    plan_name_snapshot: input.planNameSnapshot?.trim() || null,
    source: "manual" as const,
    source_key: input.sourceKey?.trim() || null,
    status: input.status,
    tool_email_link_id: input.relationshipId || null,
    tool_id: snapshot?.toolId || input.toolId || null,
    tool_name_snapshot: snapshot?.toolName || input.toolNameSnapshot?.trim() || null,
    user_id: userId,
  };

  const { data, error } = await supabase
    .from("billing_transactions")
    .insert(payload)
    .select("*")
    .single();

  if (!error) return asBillingTransaction(data as Record<string, unknown>);
  if (error.code !== "23505" || !payload.source_key) throw error;

  const { data: existing, error: existingError } = await supabase
    .from("billing_transactions")
    .select("*")
    .eq("user_id", userId)
    .eq("source", "manual")
    .eq("source_key", payload.source_key)
    .single();
  if (existingError) throw existingError;
  return asBillingTransaction(existing as Record<string, unknown>);
}

export async function updateBillingTransaction(id: string, input: UpdateBillingTransactionInput) {
  const payload: Record<string, unknown> = {};
  if (input.amount !== undefined) payload.amount = optionalAmount(input.amount) || null;
  if (input.billingTypeSnapshot !== undefined) payload.billing_type_snapshot = input.billingTypeSnapshot || null;
  if (input.currency !== undefined) payload.currency = optionalCurrency(input.currency) || null;
  if (input.note !== undefined) payload.note = input.note.trim() || null;
  if (input.paymentDate !== undefined) payload.payment_date = input.paymentDate;
  if (input.planNameSnapshot !== undefined) payload.plan_name_snapshot = input.planNameSnapshot.trim() || null;
  if (input.status !== undefined) payload.status = input.status;
  if (Object.keys(payload).length === 0) return getBillingTransaction(id);

  const supabase = createClient();
  const { data, error } = await supabase
    .from("billing_transactions")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return asBillingTransaction(data as Record<string, unknown>);
}

export async function getBillingTransaction(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("billing_transactions")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return asBillingTransaction(data as Record<string, unknown>);
}

export async function getBillingTransactions() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("billing_transactions")
    .select("*")
    .order("payment_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((record) => asBillingTransaction(record as Record<string, unknown>));
}

export async function getBillingTransactionsByRelationship(relationshipId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("billing_transactions")
    .select("*")
    .eq("tool_email_link_id", relationshipId)
    .order("payment_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((record) => asBillingTransaction(record as Record<string, unknown>));
}

export async function getBillingTransactionsByDateRange(startDate: string, endDate: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("billing_transactions")
    .select("*")
    .gte("payment_date", startDate)
    .lte("payment_date", endDate)
    .order("payment_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((record) => asBillingTransaction(record as Record<string, unknown>));
}

export async function deleteManualBillingTransaction(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("billing_transactions")
    .delete()
    .eq("id", id)
    .eq("source", "manual")
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}
