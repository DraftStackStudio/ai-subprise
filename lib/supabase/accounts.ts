import { createClient } from "@/lib/supabase/client";

export type AccountRecord = {
  colour: string;
  email_address: string;
  id: string;
  label: string;
  provider?: string | null;
};

export type AccountInput = {
  colour: string;
  email_address: string;
  label: string;
  provider: string;
};

async function currentUserId() {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;
  if (!user) throw new Error("Please sign in before saving account data.");

  return user.id;
}

export async function getAccountRecords() {
  const supabase = createClient();

  const { data: accounts, error: accountError } = await supabase
    .from("email_accounts")
    .select("*")
    .order("created_at", { ascending: true });

  if (accountError) throw accountError;

  const { data: links, error: linkError } = await supabase
    .from("tool_email_links")
    .select("email_account_id");

  if (linkError) throw linkError;

  const linkCounts = new Map<string, number>();
  links?.forEach((link) => {
    const accountId = link.email_account_id as string;
    linkCounts.set(accountId, (linkCounts.get(accountId) ?? 0) + 1);
  });

  return (accounts ?? []).map((account) => ({
    ...(account as AccountRecord),
    linked: linkCounts.get((account as AccountRecord).id) ?? 0,
  }));
}

export async function createAccountRecord(input: AccountInput) {
  const supabase = createClient();
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("email_accounts")
    .insert({ ...input, user_id: userId })
    .select("*")
    .single();

  if (error) throw error;
  return data as AccountRecord;
}

export async function updateAccountRecord(id: string, input: AccountInput) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("email_accounts")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as AccountRecord;
}

export async function deleteAccountRecord(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("email_accounts").delete().eq("id", id);
  if (error) throw error;
}
