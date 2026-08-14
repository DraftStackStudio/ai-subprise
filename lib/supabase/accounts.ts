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

type LoginRecordWithProvider = Omit<AccountRecord, "provider"> & {
  providers?: { name?: string | null } | { name?: string | null }[] | null;
};

function accountRecordFromLogin(record: LoginRecordWithProvider): AccountRecord {
  const joinedProvider = Array.isArray(record.providers) ? record.providers[0] : record.providers;
  const { providers: _providers, ...login } = record;

  return {
    ...login,
    provider: joinedProvider?.name ?? null,
  };
}

async function providerIdForName(providerName: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("providers")
    .select("id")
    .eq("name", providerName)
    .single();

  if (error) throw error;
  return String(data.id);
}

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
    .from("logins")
    .select("*,providers(name)")
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

  return (accounts ?? []).map((account) => {
    const normalizedAccount = accountRecordFromLogin(account as LoginRecordWithProvider);
    return {
      ...normalizedAccount,
      linked: linkCounts.get(normalizedAccount.id) ?? 0,
    };
  });
}

export async function createAccountRecord(input: AccountInput) {
  const supabase = createClient();
  const userId = await currentUserId();
  const providerId = await providerIdForName(input.provider);
  const { provider: _provider, ...loginInput } = input;
  const { data, error } = await supabase
    .from("logins")
    .insert({ ...loginInput, provider_id: providerId, user_id: userId })
    .select("*,providers(name)")
    .single();

  if (error) throw error;
  return accountRecordFromLogin(data as LoginRecordWithProvider);
}

export async function updateAccountRecord(id: string, input: AccountInput) {
  const supabase = createClient();
  const providerId = await providerIdForName(input.provider);
  const { provider: _provider, ...loginInput } = input;
  const { data, error } = await supabase
    .from("logins")
    .update({ ...loginInput, provider_id: providerId })
    .eq("id", id)
    .select("*,providers(name)")
    .single();

  if (error) throw error;
  return accountRecordFromLogin(data as LoginRecordWithProvider);
}

export async function deleteAccountRecord(id: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("delete_login_preserving_history", {
    target_account_id: id,
  });
  if (error) throw error;
}
