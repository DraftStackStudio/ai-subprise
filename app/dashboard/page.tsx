"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import toolCustomizationsData from "@/config/toolCustomizations.json";
import {
  createAccountRecord,
  deleteAccountRecord,
  getAccountRecords,
  updateAccountRecord,
  type AccountInput,
  type AccountRecord,
} from "@/lib/supabase/accounts";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import {
  createToolRecord,
  getToolLinkDetailRecords,
  deleteToolRecords,
  getToolRecords,
  patchToolRecord,
  replaceToolLinks,
  updateToolLinkDetails,
  updateToolRecord,
  type ToolInput,
  type ToolRecord,
} from "@/lib/supabase/tools";
import {
  Fragment,
  type CSSProperties,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Section = "dashboard" | "tools" | "linked" | "billing" | "watchlist" | "account" | "providers" | "favorites" | "archive" | "recovery" | "settings";
type ToolStatus = "Active" | "Trial" | "Free Tier" | "Paused" | "Considering" | "Cancelled" | "Paid" | "Free";
type ToolSortRange = "All" | "Category" | "A-G" | "H-N" | "O-S" | "T-Z";
type RoleOption = "Creator" | "Designer" | "Developer" | "Business" | "Researcher" | "Custom";
type PlanKey = "free" | "trial" | "paid";
type ArchivedStatusKey = "active" | "trial" | "free" | "paused" | "watchlist" | "cancelled";
type ToolCustomization = {
  allowedPlans?: PlanKey[];
  displayInitials?: string;
  planLockedReason?: string;
  preserveNameCase?: boolean;
};
type DropdownOption = {
  description?: string;
  disabled?: boolean;
  label: string;
  tag?: string;
  value: string;
};
type ToolItem = {
  id: string;
  name: string;
  category: string;
  status: ToolStatus;
  accounts: string[];
  billing: string;
  notes: string;
  favorite: boolean;
  archived: boolean;
  archivedAt?: string;
  archivedStatus?: ToolStatus;
  pricingUrl: string;
  logo: string;
  logoBg: string;
};
type Account = {
  id?: string;
  label: string;
  provider: string;
  login: string;
  tag: string;
  linked: number;
};
type ToolResetBlob = {
  category: string;
  tools: ToolItem[];
};
type ToolResetArchive = {
  id: string;
  userId: string;
  createdAt: string;
  data: ToolResetBlob[];
};
type ManageStatus = "Active" | "On a Break" | "Goodbye";
type BillingType = string;
type BillingAmount = {
  amount: string;
  billingType: BillingType;
  currency: string;
};
type ToolAccountDetail = {
  amount: string;
  billingAmounts?: BillingAmount[];
  billingType: BillingType;
  currency: string;
  nextChargeDate: string;
  planName: string;
  status: ManageStatus;
  trialExpiryDate: string;
};
type BillingEditTarget = {
  accountLabel: string;
  toolId: string;
};
type LinkToolAccountBlock = {
  accountLabel: string;
  id: string;
  plan: ToolStatus;
  planName: string;
};

const navItems: Array<{ id: Section; icon: string; label: string; badge?: number }> = [
  { id: "dashboard", icon: "grid", label: "Dashboard" },
  { id: "account", icon: "user", label: "My Account", badge: 3 },
  { id: "tools", icon: "list", label: "AI Toolbox", badge: 12 },
  { id: "linked", icon: "link", label: "Linked" },
  { id: "billing", icon: "billing", label: "Billing" },
  { id: "watchlist", icon: "eye", label: "Watchlist" },
  { id: "favorites", icon: "star", label: "Favourites", badge: 4 },
  { id: "archive", icon: "box", label: "Archived", badge: 2 },
  { id: "recovery", icon: "recovery", label: "Recently Deleted" },
  { id: "settings", icon: "gear", label: "Settings" },
];

const initialAccounts: Account[] = [];
const toolCustomizations = toolCustomizationsData as Record<string, ToolCustomization>;

const defaultProviders = ["Gmail", "iCloud", "Outlook", "Yahoo", "Github"];
const customProviderOption = "+ new provider";
const defaultToolCategories = [
  "AI Assistant",
  "Visual & Audio",
  "AI Agents",
  "Automation",
  "Research",
  "Coding",
  "Meetings",
  "Niche",
];
const categoryDescriptions: Record<string, string> = {
  "AI Assistant": "Chat & reasoning tools",
  "Visual & Audio": "Image, video & audio creation",
  Automation: "Triggers & repeats tasks",
  Research: "Search & knowledge tools",
  Coding: "Dev & coding assistants",
  "AI Agents": "Plans & executes independently",
  Meetings: "Notes & transcription",
  Niche: "Industry-specific tools",
};
const customCategoryOption = "+ new category";
const roleOptions: RoleOption[] = ["Creator", "Designer", "Developer", "Business", "Researcher", "Custom"];
const roleCategoryMap: Record<RoleOption, string[]> = {
  Creator: ["AI Assistant", "Visual & Audio", "AI Agents", "Automation"],
  Designer: ["AI Assistant", "Visual & Audio", "Research", "Meetings", "Niche"],
  Developer: ["AI Assistant", "Automation", "Coding", "AI Agents"],
  Business: ["AI Assistant", "Automation", "Research", "Meetings", "AI Agents", "Niche"],
  Researcher: ["AI Assistant", "Research", "Meetings", "Niche"],
  Custom: ["AI Assistant"],
};
const legacyCategoryMap: Record<string, string> = {
  Audio: "Visual & Audio",
  "Chat & AI": "AI Assistant",
  "Chat & Reasoning": "AI Assistant",
  "Image Gen": "Visual & Audio",
  "Image Generation": "Visual & Audio",
  LLM: "AI Assistant",
  "Media Generation": "Visual & Audio",
  Other: "Niche",
  Productivity: "Automation",
  "Video Gen": "Visual & Audio",
  "Video Generation": "Visual & Audio",
};
const toolSortOptions: Array<{ label: string; value: ToolSortRange; start: string; end: string }> = [
  { label: "By Category", value: "Category", start: "A", end: "Z" },
  { label: "All", value: "All", start: "A", end: "Z" },
  { label: "A-G", value: "A-G", start: "A", end: "G" },
  { label: "H-N", value: "H-N", start: "H", end: "N" },
  { label: "O-S", value: "O-S", start: "O", end: "S" },
  { label: "T-Z", value: "T-Z", start: "T", end: "Z" },
];

const colourOptions = [
  { label: "Gray", className: "swatch-gray", tag: "tag-gray" },
  { label: "Brown", className: "swatch-brown", tag: "tag-brown" },
  { label: "Orange", className: "swatch-orange", tag: "tag-orange" },
  { label: "Yellow", className: "swatch-yellow", tag: "tag-yellow" },
  { label: "Green", className: "swatch-green", tag: "tag-green" },
  { label: "Cyan", className: "swatch-cyan", tag: "tag-cyan" },
  { label: "Blue", className: "swatch-blue", tag: "tag-blue" },
  { label: "Purple", className: "swatch-purple", tag: "tag-purple" },
  { label: "Pink", className: "swatch-pink", tag: "tag-pink" },
  { label: "Red", className: "swatch-red", tag: "tag-red" },
];

const tools: ToolItem[] = [];
const localUserId = "local-demo-user";
const resetArchiveDays = 30;
const resetArchiveMs = resetArchiveDays * 24 * 60 * 60 * 1000;
const toolsStorageKey = "ai-subprise-tools";
const resetArchiveStorageKey = "ai-subprise-tools-reset-archive";
const toolOrderPreferenceStorageKey = "ai-subprise-tool-order-preference";
const toolAccountStatusStorageKey = "ai-subprise-tool-account-statuses";
const toolAccountPlanNameStorageKey = "ai-subprise-tool-account-plan-names";
const toolAccountDetailStorageKey = "ai-subprise-tool-account-details";
const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

function TrashIconPaths() {
  return (
    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
      <path d="M8.2 7V5.9A2.9 2.9 0 0 1 11.1 3h1.8a2.9 2.9 0 0 1 2.9 2.9V7" />
      <path d="M5.2 7h13.6v3.4H5.2V7Z" />
      <path d="m7.1 10.4.6 8.4A2.4 2.4 0 0 0 10.1 21h3.8a2.4 2.4 0 0 0 2.4-2.2l.6-8.4" />
      <path d="M10.2 13.2v4.6" />
      <path d="M12 13.2v4.6" />
      <path d="M13.8 13.2v4.6" />
    </g>
  );
}

function ArchiveBoxIconPaths() {
  return (
    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
      <path d="M5.5 7.2h13v3.1h-13V7.2Z" />
      <path d="M6.7 10.3h10.6v8.2c0 .75-.6 1.35-1.35 1.35h-7.9c-.75 0-1.35-.6-1.35-1.35v-8.2Z" />
      <path d="M9.9 13.2h4.2" />
    </g>
  );
}

function FavoriteStarIconPaths() {
  return (
    <path d="M12 4.8 14.1 9l4.6.7-3.3 3.2.8 4.5-4.2-2.2-4.1 2.2.8-4.5L5.3 9.7 9.9 9 12 4.8Z" />
  );
}

function SidebarIcon({ name }: { name: string }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
  };

  return (
    <svg aria-hidden="true" className="sidebar-icon" viewBox="0 0 24 24">
      {name === "grid" && (
        <>
          <path d="M11.25 4.35A7.65 7.65 0 1 0 19.65 13" {...common} />
          <path d="M13.1 4.35A7.65 7.65 0 0 1 19.7 11" {...common} />
          <path d="M13.1 4.35v4.15" {...common} />
          <path d="M13.1 8.5A4.15 4.15 0 0 1 16.65 11" {...common} />
          <path d="M16.65 11h3.05" {...common} />
          <circle cx="11.25" cy="12.1" r="3.85" {...common} />
        </>
      )}
      {name === "list" && (
        <>
          <path d="M6.5 7.5h11" {...common} />
          <path d="M6.5 12h11" {...common} />
          <path d="M6.5 16.5h8" {...common} />
        </>
      )}
      {name === "link" && (
        <>
          <path d="M9.5 14.5 14.5 9.5" {...common} />
          <path d="M10.5 7.5 12 6a4 4 0 0 1 5.7 5.7l-1.5 1.5" {...common} />
          <path d="M13.5 16.5 12 18a4 4 0 0 1-5.7-5.7l1.5-1.5" {...common} />
        </>
      )}
      {name === "billing" && (
        <>
          <rect x="4.7" y="6.1" width="14.6" height="11.8" rx="2.2" {...common} />
          <path d="M4.7 9.6h14.6" {...common} />
          <path d="M8 14.3h3.1" {...common} />
        </>
      )}
      {name === "eye" && (
        <>
          <path d="M4 12s2.8-5 8-5 8 5 8 5-2.8 5-8 5-8-5-8-5Z" {...common} />
          <circle cx="12" cy="12" r="2.2" {...common} />
        </>
      )}
      {name === "star" && (
        <path d="M12 4.3 14.35 9l5.2.76-3.78 3.68.9 5.2L12 16.2l-4.66 2.45.9-5.2-3.78-3.68L9.65 9 12 4.3Z" fill="currentColor" />
      )}
      {name === "box" && (
        <>
          <ArchiveBoxIconPaths />
        </>
      )}
      {name === "recovery" && (
        <>
          <TrashIconPaths />
        </>
      )}
      {name === "user" && (
        <>
          <circle cx="12" cy="8" r="3.4" fill="currentColor" />
          <path d="M5.2 19.5c1.1-3.5 3.35-5.3 6.8-5.3s5.7 1.8 6.8 5.3H5.2Z" fill="currentColor" />
        </>
      )}
      {name === "gear" && (
        <>
          <path d="M13.45 3.5 14 6.1c.5.18.98.46 1.4.8l2.48-.86 1.45 2.52-1.96 1.72c.05.28.08.57.08.86s-.03.58-.08.86l1.96 1.72-1.45 2.52-2.48-.86c-.42.34-.9.62-1.4.8l-.55 2.6h-2.9L10 16.18a5.2 5.2 0 0 1-1.4-.8l-2.48.86-1.45-2.52 1.96-1.72a5.1 5.1 0 0 1 0-1.72L4.67 8.56l1.45-2.52 2.48.86c.42-.34.9-.62 1.4-.8l.55-2.6h2.9Z" fill="currentColor" />
          <circle cx="12" cy="11.14" r="2.35" fill="#151516" />
        </>
      )}
    </svg>
  );
}

function accountTag(label: string, accountList: Account[]) {
  const found = accountList.find((account) => account.label === label);
  return found?.tag ?? "tag-gray";
}

function colourToTag(colour: string | null | undefined) {
  const normalisedColour = (colour ?? "").trim().toLowerCase();
  const hexMap: Record<string, string> = {
    "#6366f1": "tag-blue",
    "#f59e0b": "tag-orange",
    "#10b981": "tag-green",
    "#ef4444": "tag-red",
  };

  if (normalisedColour.startsWith("tag-")) return normalisedColour;
  return hexMap[normalisedColour] ?? "tag-gray";
}

function accountFromRecord(record: AccountRecord & { linked?: number }): Account {
  return {
    id: record.id,
    label: record.label,
    provider: record.provider ?? "Gmail",
    login: record.email_address,
    tag: colourToTag(record.colour),
    linked: record.linked ?? 0,
  };
}

function accountToInput(account: Pick<Account, "label" | "login" | "provider" | "tag">): AccountInput {
  return {
    colour: account.tag,
    email_address: account.login,
    label: account.label,
    provider: account.provider,
  };
}

function statusDisplayLabel(status: ToolStatus) {
  const labels: Record<ToolStatus, string> = {
    Active: "Running",
    Paid: "Running",
    Trial: "Trial mode",
    "Free Tier": "Living the free life",
    Free: "Living the free life",
    Paused: "On a break",
    Considering: "On the watchlist",
    Cancelled: "Goodbye, it was a journey",
  };

  return labels[status] ?? status;
}

function normaliseManageStatus(status: string): ManageStatus {
  if (status === "On a break" || status === "On a Break") return "On a Break";
  if (status === "Goodbye it was a journey" || status === "Goodbye, it was a journey" || status === "Goodbye") return "Goodbye";
  return "Active";
}

function normaliseBillingType(value: string): BillingType {
  if (value === "Yearly" || value === "Annual") return "Annual";
  if (value === "One-time" || value === "Top-up Credit") return value;
  if (value.includes(",")) return value;
  return "Monthly";
}

const currencyOptions: DropdownOption[] = ["USD", "SGD", "EUR", "GBP", "AUD"].map((currency) => ({
  label: currency,
  value: currency,
}));

const currencySymbols: Record<string, string> = {
  AUD: "A$",
  EUR: "€",
  GBP: "£",
  SGD: "S$",
  USD: "$",
};
const accountNicknameMaxLength = 15;

function normaliseCurrency(value?: string) {
  const nextValue = value?.trim().toUpperCase();
  return nextValue && currencySymbols[nextValue] ? nextValue : "USD";
}

function archivedStatusKey(status: ToolStatus): ArchivedStatusKey {
  if (status === "Trial") return "trial";
  if (status === "Free" || status === "Free Tier") return "free";
  if (status === "Paused") return "paused";
  if (status === "Considering") return "watchlist";
  if (status === "Cancelled") return "cancelled";
  return "active";
}

function archivedStatusLabel(status: ToolStatus) {
  const labels: Record<ArchivedStatusKey, string> = {
    active: "Active",
    trial: "Trial",
    free: "Free",
    paused: "Paused",
    watchlist: "Watchlist",
    cancelled: "Cancelled",
  };

  return labels[archivedStatusKey(status)];
}

function archivedStatusTone(status: ToolStatus) {
  const tones: Record<ArchivedStatusKey, string> = {
    active: "status-running",
    trial: "status-trial",
    free: "status-free",
    paused: "status-muted",
    watchlist: "status-watch",
    cancelled: "status-cancelled",
  };

  return tones[archivedStatusKey(status)];
}

function statusTone(status: ToolStatus) {
  if (status === "Trial") return "status-trial";
  if (status === "Free" || status === "Free Tier") return "status-free";
  if (status === "Paused" || status === "Cancelled") return "status-muted";
  if (status === "Considering") return "status-watch";
  return "status-running";
}

function formatArchiveDate(value?: string) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatShortDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}

function formatBillingDate(value: string) {
  if (!value) return "Select date";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Select date";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function daysUntilDate(value: string) {
  const targetDate = new Date(`${value}T00:00:00`);
  if (Number.isNaN(targetDate.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);

  return Math.ceil((targetDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

function formatNickname(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function toolCustomizationKey(value: string) {
  const key = value.trim().toLowerCase();
  if (key === "n8n") return "n8n";
  return key;
}

function toolCustomizationFor(value: string) {
  return toolCustomizations[toolCustomizationKey(value)];
}

function displayToolName(value: string) {
  const customization = toolCustomizationFor(value);
  if (customization?.preserveNameCase) return toolCustomizationKey(value);
  return formatNickname(value);
}

function toolInitials(value: string) {
  const customization = toolCustomizationFor(value);
  if (customization?.displayInitials) return customization.displayInitials;

  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "AI";
  return words[0].charAt(0).toUpperCase();
}

function createToolId(value: string) {
  return `${value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`;
}

function normaliseToolCategory(category: string) {
  const trimmedCategory = category?.trim() || "Uncategorized";
  return legacyCategoryMap[trimmedCategory] ?? trimmedCategory;
}

function normaliseCategoryList(categories: string[]) {
  return Array.from(
    new Set(
      categories
        .map((category) => normaliseToolCategory(category))
        .filter(Boolean),
    ),
  );
}

function toolFromRecord(record: ToolRecord): ToolItem {
  return {
    accounts: record.accounts,
    archived: record.archived,
    archivedAt: record.archivedAt,
    archivedStatus: record.archivedStatus as ToolStatus | undefined,
    billing: record.billing,
    category: normaliseToolCategory(record.category),
    favorite: record.favorite,
    id: record.id,
    logo: record.logo,
    logoBg: record.logoBg,
    name: record.name,
    notes: record.notes,
    pricingUrl: record.pricingUrl,
    status: record.status as ToolStatus,
  };
}

function toolToInput(tool: ToolItem): ToolInput {
  return {
    accounts: tool.accounts,
    archived: tool.archived,
    archivedAt: tool.archivedAt,
    archivedStatus: tool.archivedStatus,
    billing: tool.billing,
    category: normaliseToolCategory(tool.category),
    favorite: tool.favorite,
    id: tool.id,
    logo: tool.logo,
    logoBg: tool.logoBg,
    name: tool.name,
    notes: tool.notes,
    pricingUrl: tool.pricingUrl,
    status: tool.status,
  };
}

function withToolIds(items: ToolItem[]) {
  return items.map((item) => ({
    ...item,
    category: normaliseToolCategory(item.category),
    id: item.id || createToolId(item.name),
  }));
}

function isArchiveExpired(archive: ToolResetArchive) {
  return Date.now() - new Date(archive.createdAt).getTime() >= resetArchiveMs;
}

function archiveTools(archive: ToolResetArchive) {
  return archive.data.flatMap((group) => group.tools.map((tool) => ({ ...tool, category: group.category })));
}

function archiveToolCount(archives: ToolResetArchive[]) {
  return archives.reduce((count, archive) => count + archiveTools(archive).length, 0);
}

function createResetBlob(items: ToolItem[]) {
  const categoryNames = Array.from(new Set(items.map((tool) => normaliseToolCategory(tool.category))));

  return categoryNames.map((category) => ({
    category,
    tools: items
      .filter((tool) => normaliseToolCategory(tool.category) === category)
      .map((tool) => ({ ...tool, category })),
  }));
}

function restoreCategory(category: string, availableCategories: string[]) {
  const normalisedCategory = normaliseToolCategory(category);
  return availableCategories.includes(normalisedCategory) ? normalisedCategory : "Uncategorized";
}

function sortCategoriesWithUncategorizedLast(categories: string[]) {
  return [...categories].sort((firstCategory, secondCategory) => {
    const firstIsUncategorized = firstCategory === "Uncategorized";
    const secondIsUncategorized = secondCategory === "Uncategorized";

    if (firstIsUncategorized === secondIsUncategorized) return 0;
    return firstIsUncategorized ? 1 : -1;
  });
}

function validateLogin(provider: string, login: string) {
  const trimmedLogin = login.trim();
  const emailProviders = ["Gmail", "iCloud", "Outlook", "Yahoo"];

  if (!trimmedLogin) return null;

  if (provider === "Github") {
    if (/\s/.test(login)) {
      return { message: "Username cannot contain spaces", type: "error" as const };
    }

    if (!/^[A-Za-z0-9-]+$/.test(trimmedLogin)) {
      return {
        message: "GitHub username: letters, numbers, hyphens (-) only",
        type: "error" as const,
      };
    }

    return { message: "Username format looks good", type: "success" as const };
  }

  if (/\s/.test(login)) {
    return {
      message: "Email address cannot contain spaces",
      type: "error" as const,
    };
  }

  if (!emailProviders.includes(provider)) {
    const defaultProviderMatch = detectDefaultProviderLogin(trimmedLogin);

    if (defaultProviderMatch) {
      return {
        message: `This looks like a ${defaultProviderMatch} login. Check if the provider should be ${defaultProviderMatch}.`,
        type: "error" as const,
      };
    }

    return null;
  }

  if (!trimmedLogin.includes("@")) {
    return { message: "Please include an '@' in the email address.", type: "error" as const };
  }

  const emailParts = trimmedLogin.split("@");
  if (emailParts.length !== 2 || !emailParts[0] || !emailParts[1]) {
    return { message: "Please enter a complete email address", type: "error" as const };
  }

  const domain = emailParts[1].toLowerCase();

  if (provider === "Gmail" && domain !== "gmail.com") {
    return { message: "Gmail login must end with @gmail.com", type: "error" as const };
  }

  if (provider === "iCloud" && domain !== "icloud.com") {
    return { message: "iCloud login must end with @icloud.com", type: "error" as const };
  }

  if (provider === "Outlook" && domain !== "outlook.com" && domain !== "hotmail.com") {
    return { message: "Outlook login must end with @outlook.com or @hotmail.com", type: "error" as const };
  }

  if (provider === "Yahoo" && domain !== "yahoo.com" && !domain.startsWith("yahoo.com.")) {
    return { message: "Yahoo login must end with @yahoo.com or a local Yahoo domain", type: "error" as const };
  }

  return { message: "Email format looks good", type: "success" as const };
}

function detectDefaultProviderLogin(login: string) {
  const lowerLogin = login.toLowerCase();
  const domain = lowerLogin.includes("@") ? lowerLogin.split("@").pop() ?? "" : lowerLogin;

  if (domain === "gmail.com") return "Gmail";
  if (domain === "icloud.com") return "iCloud";
  if (domain === "outlook.com" || domain === "hotmail.com") return "Outlook";
  if (domain === "yahoo.com" || domain.startsWith("yahoo.com.")) return "Yahoo";

  return "";
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const isDemoMode = searchParams.get("demo") === "1";
  const shouldUseSupabase = isSupabaseConfigured && !isDemoMode;
  const createAccountPromptStorageKey = isDemoMode
    ? "ai-subprise-demo-create-account-prompt-seen"
    : "ai-subprise-create-account-prompt-seen";
  const initialView = searchParams.get("view") === "account" ? "account" : "dashboard";
  const [activeSection, setActiveSection] = useState<Section>(initialView);
  const [activeCategory, setActiveCategory] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isToolsNavOpen, setIsToolsNavOpen] = useState(true);
  const [showCreateAccountModal, setShowCreateAccountModal] = useState(false);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [showAddToolModal, setShowAddToolModal] = useState(false);
  const [showRoleQuestionModal, setShowRoleQuestionModal] = useState(false);
  const [showCategoryPreviewModal, setShowCategoryPreviewModal] = useState(false);
  const [showCategoryInfoModal, setShowCategoryInfoModal] = useState(false);
  const [showEditCategoryModal, setShowEditCategoryModal] = useState(false);
  const [showLinkToolModal, setShowLinkToolModal] = useState(false);
  const [showResetArchiveWarning, setShowResetArchiveWarning] = useState(false);
  const [showResetTypeModal, setShowResetTypeModal] = useState(false);
  const [pendingResetMode, setPendingResetMode] = useState<"blank" | "template" | null>(null);
  const [showResetDangerModal, setShowResetDangerModal] = useState(false);
  const [showRestoreArchiveModal, setShowRestoreArchiveModal] = useState(false);
  const [showRecoveryPanel, setShowRecoveryPanel] = useState(false);
  const [accountToast, setAccountToast] = useState("");
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editingTool, setEditingTool] = useState<ToolItem | null>(null);
  const [confirmToolStateChange, setConfirmToolStateChange] = useState<{
    action: "unfavorite" | "unarchive";
    tool: ToolItem;
  } | null>(null);
  const [watchlistMoveTool, setWatchlistMoveTool] = useState<ToolItem | null>(null);
  const [expandedToolIds, setExpandedToolIds] = useState<string[]>([]);
  const [isLinkToolLocked, setIsLinkToolLocked] = useState(false);
  const [linkToolActivateToolId, setLinkToolActivateToolId] = useState("");
  const [managingLink, setManagingLink] = useState<{ accountLabel: string; toolId: string } | null>(null);
  const [managedAccountLabel, setManagedAccountLabel] = useState("");
  const [managedPlan, setManagedPlan] = useState<ToolStatus>("Free Tier");
  const [managedPlanName, setManagedPlanName] = useState("");
  const [managedBillingType, setManagedBillingType] = useState<BillingType>("Monthly");
  const [managedBillingAmounts, setManagedBillingAmounts] = useState<BillingAmount[]>([
    { amount: "", billingType: "Monthly", currency: "USD" },
  ]);
  const [managedNextChargeDate, setManagedNextChargeDate] = useState("");
  const [managedTrialExpiryDate, setManagedTrialExpiryDate] = useState("");
  const [managedStatus, setManagedStatus] = useState<ManageStatus>("Active");
  const [editingBillingLink, setEditingBillingLink] = useState<BillingEditTarget | null>(null);
  const [billingPlanName, setBillingPlanName] = useState("");
  const [billingBillingType, setBillingBillingType] = useState<BillingType>("Monthly");
  const [billingCurrency, setBillingCurrency] = useState("USD");
  const [billingAmount, setBillingAmount] = useState("");
  const [billingNextChargeDate, setBillingNextChargeDate] = useState("");
  const [toolAccountStatuses, setToolAccountStatuses] = useState<Record<string, Record<string, ToolStatus>>>({});
  const [toolAccountPlanNames, setToolAccountPlanNames] = useState<Record<string, Record<string, string>>>({});
  const [toolAccountDetails, setToolAccountDetails] = useState<Record<string, Record<string, ToolAccountDetail>>>({});
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [deletingProvider, setDeletingProvider] = useState<string | null>(null);
  const [accountList, setAccountList] = useState<Account[]>(initialAccounts);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const [accountDataError, setAccountDataError] = useState("");
  const [toolList, setToolList] = useState(tools);
  const [isLoadingTools, setIsLoadingTools] = useState(false);
  const [isSavingTool, setIsSavingTool] = useState(false);
  const [toolDataError, setToolDataError] = useState("");
  const validAccountLabels = useMemo(() => new Set(accountList.map((account) => account.label)), [accountList]);
  const toolsWithValidAccountLinks = useMemo(
    () =>
      toolList.map((tool) => ({
        ...tool,
        accounts: tool.accounts.filter((accountLabel) => validAccountLabels.has(accountLabel)),
      })),
    [toolList, validAccountLabels],
  );
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [defaultCurrency, setDefaultCurrency] = useState("USD");
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [reminderDays, setReminderDays] = useState("7");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [toolResetArchives, setToolResetArchives] = useState<ToolResetArchive[]>([]);
  const [hasLoadedStoredTools, setHasLoadedStoredTools] = useState(false);
  const [customProviders, setCustomProviders] = useState<string[]>([]);
  const [customToolCategories, setCustomToolCategories] = useState<string[]>([]);
  const [workspaceCategories, setWorkspaceCategories] = useState<string[]>([]);
  const [providerName, setProviderName] = useState("");
  const [isCustomProviderMode, setIsCustomProviderMode] = useState(false);
  const [isCustomCategoryMode, setIsCustomCategoryMode] = useState(false);
  const [nickname, setNickname] = useState("");
  const [hasAttemptedNicknameOverflow, setHasAttemptedNicknameOverflow] = useState(false);
  const [provider, setProvider] = useState("");
  const providerRef = useRef("");
  const [login, setLogin] = useState("");
  const [toolName, setToolName] = useState("");
  const [toolCategory, setToolCategory] = useState("");
  const [toolUrl, setToolUrl] = useState("");
  const [linkToolId, setLinkToolId] = useState("");
  const [linkToolAccountBlocks, setLinkToolAccountBlocks] = useState<LinkToolAccountBlock[]>([
    { accountLabel: "", id: "link-account-1", plan: "Free Tier", planName: "" },
  ]);
  const [linkToolSearchQuery, setLinkToolSearchQuery] = useState("");
  const [isLinkToolPickerOpen, setIsLinkToolPickerOpen] = useState(false);
  const [toolSearchQuery, setToolSearchQuery] = useState("");
  const [categoryDrafts, setCategoryDrafts] = useState<string[]>([]);
  const [categoryDeleteWarning, setCategoryDeleteWarning] = useState<{
    category: string;
    index: number;
    toolCount: number;
  } | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [restoreToolIds, setRestoreToolIds] = useState<string[]>([]);
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([]);
  const [selectedRecoveryKeys, setSelectedRecoveryKeys] = useState<string[]>([]);
  const [expandedRecoveryIds, setExpandedRecoveryIds] = useState<string[]>([]);
  const [recoverySearch, setRecoverySearch] = useState("");
  const [selectedColour, setSelectedColour] = useState(colourOptions[0]);
  const [isColourMenuOpen, setIsColourMenuOpen] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [selectedToolSort, setSelectedToolSort] = useState<ToolSortRange>("Category");
  const [selectedBillingView, setSelectedBillingView] = useState<"All" | "Month">("All");
  const [hasCustomToolOrder, setHasCustomToolOrder] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleOption>("Creator");
  const [roleQuestionChoice, setRoleQuestionChoice] = useState<RoleOption | "">("");
  const nicknameInputRef = useRef<HTMLInputElement | null>(null);
  const toolNameInputRef = useRef<HTMLInputElement | null>(null);
  const accountToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedRoleCategories, setSelectedRoleCategories] = useState<string[]>(roleCategoryMap.Creator);
  const [draggedAccountLogin, setDraggedAccountLogin] = useState<string | null>(null);
  const [draggedToolName, setDraggedToolName] = useState<string | null>(null);
  const [draggedCategoryIndex, setDraggedCategoryIndex] = useState<number | null>(null);
  const [editingToolName, setEditingToolName] = useState<string | null>(null);
  const [editingToolCategoryId, setEditingToolCategoryId] = useState<string | null>(null);
  const [toolNameDraft, setToolNameDraft] = useState("");
  const [hasSubmittedAccountForm, setHasSubmittedAccountForm] = useState(false);
  const [hasSubmittedToolForm, setHasSubmittedToolForm] = useState(false);
  const hasConfirmedCategories = workspaceCategories.length > 0;

  useEffect(() => {
    if (activeSection === "watchlist" && selectedToolSort !== "Category" && selectedToolSort !== "All") {
      setSelectedToolSort("Category");
    }
  }, [activeSection, selectedToolSort]);

  const updateAccountProvider = (nextProvider: string) => {
    providerRef.current = nextProvider;
    setProvider(nextProvider);
  };

  const renderDropdown = ({
    ariaLabel,
    className = "",
    id,
    onChange,
    onClose,
    options,
    placeholder,
    selectedLabel,
    value,
  }: {
    ariaLabel?: string;
    className?: string;
    id: string;
    onChange: (value: string) => void;
    onClose?: () => void;
    options: DropdownOption[];
    placeholder?: string;
    selectedLabel?: string;
    value: string;
  }) => {
    const isOpen = openDropdownId === id;
    const selectedOption = options.find((option) => option.value === value);
    const displayLabel = selectedLabel ?? selectedOption?.label ?? placeholder ?? "Select";

    return (
      <div
        className={`custom-select ${isOpen ? "is-open" : ""} ${className}`}
        id={id}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setOpenDropdownId(null);
            onClose?.();
          }
        }}
      >
        <button
          aria-expanded={isOpen}
          aria-label={ariaLabel}
          className={selectedOption ? "custom-select-trigger" : "custom-select-trigger is-placeholder"}
          onClick={(event) => {
            event.stopPropagation();
            setOpenDropdownId((currentId) => (currentId === id ? null : id));
          }}
          type="button"
        >
          <span className="dropdown-option-label">
            {selectedOption?.tag ? <span className={`tag-dot ${selectedOption.tag}`} /> : null}
            <span>{displayLabel}</span>
          </span>
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {isOpen ? (
          <div className="custom-select-options">
            {options.map((option) => (
              <button
                className={option.value === value ? "custom-select-option is-selected" : "custom-select-option"}
                disabled={option.disabled}
                key={option.value}
                onMouseDown={(event) => event.preventDefault()}
                onClick={(event) => {
                  event.stopPropagation();
                  if (option.disabled) return;
                  onChange(option.value);
                  setOpenDropdownId(null);
                  onClose?.();
                }}
                type="button"
              >
                <span className="dropdown-option-label">
                  {option.tag ? <span className={`tag-dot ${option.tag}`} /> : null}
                  <span className="dropdown-option-text">
                    <span>{option.label}</span>
                    {option.description ? <small>{option.description}</small> : null}
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  const renderMultiSelectDropdown = ({
    ariaLabel,
    className = "",
    id,
    onChange,
    options,
    placeholder = "Select",
    values,
  }: {
    ariaLabel?: string;
    className?: string;
    id: string;
    onChange: (values: string[]) => void;
    options: DropdownOption[];
    placeholder?: string;
    values: string[];
  }) => {
    const isOpen = openDropdownId === id;
    const selectedLabels = options
      .filter((option) => values.includes(option.value) && option.value)
      .map((option) => option.label);
    const displayLabel = selectedLabels.length > 0
      ? selectedLabels.join(", ")
      : placeholder;

    return (
      <div
        className={`custom-select multi-select ${isOpen ? "is-open" : ""} ${className}`}
        id={id}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setOpenDropdownId(null);
          }
        }}
      >
        <button
          aria-expanded={isOpen}
          aria-label={ariaLabel}
          className={selectedLabels.length > 0 ? "custom-select-trigger" : "custom-select-trigger is-placeholder"}
          onClick={(event) => {
            event.stopPropagation();
            setOpenDropdownId((currentId) => (currentId === id ? null : id));
          }}
          type="button"
        >
          <span>{displayLabel || placeholder}</span>
          {selectedLabels.length > 0 ? <small>{selectedLabels.length} selected</small> : null}
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {isOpen ? (
          <div className="custom-select-options">
            {options.map((option) => {
              const isChecked = values.includes(option.value);
              return (
                <button
                  className={isChecked ? "custom-select-option multi-select-option is-selected" : "custom-select-option multi-select-option"}
                  disabled={option.disabled}
                  key={option.value || "no-account-linked"}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (option.disabled) return;

                    if (!option.value) {
                      onChange([]);
                      return;
                    }

                    onChange(
                      isChecked
                        ? values.filter((currentValue) => currentValue !== option.value)
                        : [...values, option.value],
                    );
                  }}
                  type="button"
                >
                  <input checked={isChecked} readOnly type="checkbox" />
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  };

  useEffect(() => {
    if (!isDemoMode && searchParams.get("welcome") !== "1") return;

    let hasSeenCreateAccountPrompt = false;
    try {
      hasSeenCreateAccountPrompt = window.localStorage.getItem(createAccountPromptStorageKey) === "true";
    } catch {
      hasSeenCreateAccountPrompt = false;
    }

    if (!hasSeenCreateAccountPrompt) {
      setShowCreateAccountModal(true);
    }
  }, [createAccountPromptStorageKey, isDemoMode, searchParams]);

  useEffect(() => {
    try {
      const storedOpenState = window.localStorage.getItem("ai-subprise-tools-nav-open");
      const storedCategories = window.localStorage.getItem("ai-subprise-workspace-categories");
      const storedTools = window.localStorage.getItem(toolsStorageKey);
      const storedArchive = window.localStorage.getItem(resetArchiveStorageKey);
      const storedToolOrderPreference = window.localStorage.getItem(toolOrderPreferenceStorageKey);
      const storedToolAccountStatuses = window.localStorage.getItem(toolAccountStatusStorageKey);
      const storedToolAccountPlanNames = window.localStorage.getItem(toolAccountPlanNameStorageKey);
      const storedToolAccountDetails = window.localStorage.getItem(toolAccountDetailStorageKey);
      const storedDefaultCurrency = window.localStorage.getItem("ai-subprise-default-currency");
      const storedRemindersEnabled = window.localStorage.getItem("ai-subprise-reminders-enabled");
      const storedReminderDays = window.localStorage.getItem("ai-subprise-reminder-days");

      if (storedDefaultCurrency) setDefaultCurrency(normaliseCurrency(storedDefaultCurrency));
      if (storedRemindersEnabled !== null) setRemindersEnabled(storedRemindersEnabled === "true");
      if (["3", "7", "14"].includes(storedReminderDays ?? "")) setReminderDays(storedReminderDays ?? "7");

      setHasCustomToolOrder(storedToolOrderPreference === "custom");
      if (storedToolAccountStatuses) {
        setToolAccountStatuses(JSON.parse(storedToolAccountStatuses));
      }
      if (storedToolAccountPlanNames) {
        setToolAccountPlanNames(JSON.parse(storedToolAccountPlanNames));
      }
      if (storedToolAccountDetails) {
        const parsedDetails = JSON.parse(storedToolAccountDetails) as Record<string, Record<string, Partial<ToolAccountDetail>>>;
        const normalisedDetails = Object.entries(parsedDetails).reduce<Record<string, Record<string, ToolAccountDetail>>>(
          (nextDetails, [toolId, accountDetails]) => ({
            ...nextDetails,
            [toolId]: Object.entries(accountDetails).reduce<Record<string, ToolAccountDetail>>(
              (nextToolDetails, [accountLabel, detail]) => ({
                ...nextToolDetails,
                [accountLabel]: {
                  amount: detail.amount ?? "",
                  billingAmounts: detail.billingAmounts?.map((entry) => ({
                    amount: entry.amount ?? "",
                    billingType: normaliseBillingType(entry.billingType),
                    currency: normaliseCurrency(entry.currency),
                  })),
                  billingType: normaliseBillingType(detail.billingType ?? "Monthly"),
                  currency: normaliseCurrency(detail.currency),
                  nextChargeDate: detail.nextChargeDate ?? "",
                  planName: detail.planName ?? "",
                  status: normaliseManageStatus(detail.status ?? "Active"),
                  trialExpiryDate: detail.trialExpiryDate ?? "",
                },
              }),
              {},
            ),
          }),
          {},
        );
        setToolAccountDetails(normalisedDetails);
      }

      if (storedOpenState) {
        setIsToolsNavOpen(storedOpenState === "true");
      }

      if (storedCategories) {
        const parsedCategories = JSON.parse(storedCategories);
        if (Array.isArray(parsedCategories)) {
          const nextCategories = normaliseCategoryList(
            parsedCategories.filter((category): category is string => typeof category === "string"),
          );
          setWorkspaceCategories(nextCategories);
          window.localStorage.setItem("ai-subprise-workspace-categories", JSON.stringify(nextCategories));
        }
      }

      if (storedTools) {
        const parsedTools = JSON.parse(storedTools);
        if (Array.isArray(parsedTools)) {
          const nextTools = withToolIds(parsedTools as ToolItem[]);
          setToolList(nextTools);
          window.localStorage.setItem(toolsStorageKey, JSON.stringify(nextTools));
        }
      }

      if (storedArchive) {
        const parsedArchive = JSON.parse(storedArchive) as ToolResetArchive[] | (ToolResetArchive & { tools?: ToolItem[] });
        const archiveEvents = Array.isArray(parsedArchive)
          ? parsedArchive
          : parsedArchive?.tools
            ? [{
                id: `reset-${new Date(parsedArchive.createdAt).getTime().toString(36)}`,
                userId: parsedArchive.userId,
                createdAt: parsedArchive.createdAt,
                data: createResetBlob(withToolIds(parsedArchive.tools)),
              }]
            : [parsedArchive as ToolResetArchive].filter(Boolean);
        const validArchives = archiveEvents
          .map((archive) => ({
            ...archive,
            data: archive.data.map((group) => ({
              ...group,
              tools: withToolIds(group.tools),
            })),
          }))
          .filter((archive) => archive.data.some((group) => group.tools.length > 0) && !isArchiveExpired(archive))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        setToolResetArchives(validArchives);
        setExpandedRecoveryIds(validArchives.map((archive) => archive.id));
        if (validArchives.length > 0) {
          window.localStorage.setItem(resetArchiveStorageKey, JSON.stringify(validArchives));
        } else {
          window.localStorage.removeItem(resetArchiveStorageKey);
        }
      }
    } catch {
      // Local storage can be unavailable in private or embedded browser contexts.
    } finally {
      setHasLoadedStoredTools(true);
    }
  }, []);

  useEffect(() => {
    if (shouldUseSupabase || !hasLoadedStoredTools) return;

    setToolList((currentTools) => {
      let hasRemovedStaleLinks = false;
      const nextTools = currentTools.map((tool) => {
        const nextAccounts = tool.accounts.filter((accountLabel) => validAccountLabels.has(accountLabel));
        if (nextAccounts.length === tool.accounts.length) return tool;

        hasRemovedStaleLinks = true;
        return { ...tool, accounts: nextAccounts };
      });

      if (!hasRemovedStaleLinks) return currentTools;

      try {
        window.localStorage.setItem(toolsStorageKey, JSON.stringify(nextTools));
      } catch {
        // Local storage can be unavailable in private or embedded browser contexts.
      }

      return nextTools;
    });
  }, [hasLoadedStoredTools, shouldUseSupabase, validAccountLabels]);

  useEffect(() => {
    if (!shouldUseSupabase) return;

    let isCancelled = false;
    setIsLoadingAccounts(true);
    setAccountDataError("");

    getAccountRecords()
      .then((records) => {
        if (isCancelled) return;
        setAccountList(records.map(accountFromRecord));
      })
      .catch((error: unknown) => {
        if (isCancelled) return;
        const message = error instanceof Error ? error.message : "Could not load accounts from Supabase.";
        setAccountDataError(message);
      })
      .finally(() => {
        if (!isCancelled) setIsLoadingAccounts(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [shouldUseSupabase]);

  useEffect(() => {
    if (!shouldUseSupabase) return;

    let isCancelled = false;
    const supabase = createSupabaseClient();

    supabase.auth.getUser().then(({ data, error }) => {
      if (isCancelled) return;
      if (error) {
        setProfileError(error.message);
        return;
      }

      setCurrentUserEmail(data.user?.email ?? "");
    });

    return () => {
      isCancelled = true;
    };
  }, [shouldUseSupabase]);

  useEffect(() => {
    if (!shouldUseSupabase) return;

    let isCancelled = false;
    setIsLoadingTools(true);
    setToolDataError("");

    getToolRecords()
      .then(async (records) => {
        if (isCancelled) return;
        setToolList(records.map(toolFromRecord));
        const linkDetails = await getToolLinkDetailRecords();
        if (isCancelled) return;

        const nextStatuses: Record<string, Record<string, ToolStatus>> = {};
        const nextPlanNames: Record<string, Record<string, string>> = {};
        const nextDetails: Record<string, Record<string, ToolAccountDetail>> = {};

        linkDetails.forEach((detail) => {
          nextStatuses[detail.toolId] = {
            ...(nextStatuses[detail.toolId] ?? {}),
            [detail.accountLabel]: detail.plan as ToolStatus,
          };
          nextPlanNames[detail.toolId] = {
            ...(nextPlanNames[detail.toolId] ?? {}),
            [detail.accountLabel]: detail.planName,
          };
          nextDetails[detail.toolId] = {
            ...(nextDetails[detail.toolId] ?? {}),
            [detail.accountLabel]: {
              amount: detail.amount,
              billingType: normaliseBillingType(detail.billingType),
              currency: normaliseCurrency(detail.currency),
              nextChargeDate: detail.nextChargeDate,
              planName: detail.planName,
              status: normaliseManageStatus(detail.status),
              trialExpiryDate: detail.trialExpiryDate,
            },
          };
        });

        setToolAccountStatuses(nextStatuses);
        setToolAccountPlanNames(nextPlanNames);
        setToolAccountDetails(nextDetails);
      })
      .catch((error: unknown) => {
        if (isCancelled) return;
        const message = error instanceof Error ? error.message : "Could not load AI tools from Supabase.";
        setToolDataError(message);
      })
      .finally(() => {
        if (!isCancelled) setIsLoadingTools(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [shouldUseSupabase]);

  useEffect(() => {
    if (!hasLoadedStoredTools) return;

    try {
      window.localStorage.setItem(toolsStorageKey, JSON.stringify(toolList));
    } catch {
      // Local storage can be unavailable in private or embedded browser contexts.
    }
  }, [hasLoadedStoredTools, toolList]);

  useEffect(() => {
    if (!hasLoadedStoredTools) return;

    try {
      window.localStorage.setItem(toolAccountStatusStorageKey, JSON.stringify(toolAccountStatuses));
    } catch {
      // Local storage can be unavailable in private or embedded browser contexts.
    }
  }, [hasLoadedStoredTools, toolAccountStatuses]);

  useEffect(() => {
    if (!hasLoadedStoredTools) return;

    try {
      window.localStorage.setItem(toolAccountPlanNameStorageKey, JSON.stringify(toolAccountPlanNames));
    } catch {
      // Local storage can be unavailable in private or embedded browser contexts.
    }
  }, [hasLoadedStoredTools, toolAccountPlanNames]);

  useEffect(() => {
    if (!hasLoadedStoredTools) return;

    try {
      window.localStorage.setItem(toolAccountDetailStorageKey, JSON.stringify(toolAccountDetails));
    } catch {
      // Local storage can be unavailable in private or embedded browser contexts.
    }
  }, [hasLoadedStoredTools, toolAccountDetails]);

  useEffect(() => {
    const existingToolIds = new Set(toolList.map((tool) => tool.id));
    setSelectedToolIds((currentIds) => currentIds.filter((toolId) => existingToolIds.has(toolId)));
  }, [toolList]);

  useEffect(() => {
    if (toolResetArchives.length === 0) return;

    const removeExpiredArchive = () => {
      const validArchives = toolResetArchives.filter((archive) => !isArchiveExpired(archive));
      if (validArchives.length === toolResetArchives.length) return;

      setToolResetArchives(validArchives);
      setExpandedRecoveryIds((currentIds) => currentIds.filter((id) => validArchives.some((archive) => archive.id === id)));
      setSelectedRecoveryKeys((currentKeys) =>
        currentKeys.filter((key) => validArchives.some((archive) => key.startsWith(`${archive.id}:`))),
      );
      try {
        if (validArchives.length > 0) {
          window.localStorage.setItem(resetArchiveStorageKey, JSON.stringify(validArchives));
        } else {
          window.localStorage.removeItem(resetArchiveStorageKey);
        }
      } catch {
        // Local storage can be unavailable in private or embedded browser contexts.
      }
    };

    removeExpiredArchive();
    const expiryInterval = window.setInterval(removeExpiredArchive, 60 * 60 * 1000);

    return () => window.clearInterval(expiryInterval);
  }, [toolResetArchives]);

  useEffect(() => {
    return () => {
      if (accountToastTimeoutRef.current) {
        clearTimeout(accountToastTimeoutRef.current);
      }
    };
  }, []);

  const showToast = (message: string) => {
    if (accountToastTimeoutRef.current) {
      clearTimeout(accountToastTimeoutRef.current);
    }

    setAccountToast(message);
    accountToastTimeoutRef.current = setTimeout(() => {
      setAccountToast("");
      accountToastTimeoutRef.current = null;
    }, 2200);
  };

  const copyAccountLogin = async (loginValue: string) => {
    try {
      await navigator.clipboard.writeText(loginValue);
      showToast("Copied.");
    } catch {
      showToast("Could not copy.");
    }
  };

  const toggleToolsNav = () => {
    setIsToolsNavOpen((isOpen) => {
      const nextOpenState = !isOpen;
      try {
        window.localStorage.setItem("ai-subprise-tools-nav-open", String(nextOpenState));
      } catch {
        // Local storage can be unavailable in private or embedded browser contexts.
      }
      return nextOpenState;
    });
  };

  const dismissCreateAccountModal = () => {
    try {
      window.localStorage.setItem(createAccountPromptStorageKey, "true");
    } catch {
      // Storage can be unavailable in private or embedded browser contexts.
    }
    setShowCreateAccountModal(false);
  };

  const openAccountSetup = () => {
    try {
      window.localStorage.setItem(createAccountPromptStorageKey, "true");
    } catch {
      // Storage can be unavailable in private or embedded browser contexts.
    }
    setActiveSection("account");
    setShowCreateAccountModal(false);
  };

  const openAddAccountModal = () => {
    setNickname("");
    setHasAttemptedNicknameOverflow(false);
    updateAccountProvider("");
    setIsCustomProviderMode(false);
    setLogin("");
    setSelectedColour(colourOptions[0]);
    setIsColourMenuOpen(false);
    setEditingAccount(null);
    setHasSubmittedAccountForm(false);
    setAccountDataError("");
    setShowAddAccountModal(true);
  };

  const openEditAccountModal = (account: Account) => {
    const accountColour = colourOptions.find((option) => option.tag === account.tag) ?? colourOptions[0];
    const isKnownProvider = defaultProviders.includes(account.provider) || customProviders.includes(account.provider);

    setNickname(account.label);
    setHasAttemptedNicknameOverflow(false);
    updateAccountProvider(account.provider);
    setIsCustomProviderMode(!isKnownProvider);
    setLogin(account.login);
    setSelectedColour(accountColour);
    setIsColourMenuOpen(false);
    setEditingAccount(account);
    setHasSubmittedAccountForm(false);
    setAccountDataError("");
    setShowAddAccountModal(true);
  };

  const openAddToolModal = () => {
    setToolName("");
    setToolCategory("");
    setToolUrl("");
    setIsCustomCategoryMode(false);
    setEditingTool(null);
    setHasSubmittedToolForm(false);
    setToolDataError("");
    setShowAddToolModal(true);
  };

  const handleAddToolClick = () => {
    if (activeSection === "linked") {
      openLinkToolModal();
      return;
    }

    if (activeSection === "tools" && !hasConfirmedCategories) {
      openRoleQuestionModal();
      return;
    }

    openAddToolModal();
  };

  const openEditToolModal = (tool: ToolItem) => {
    const isKnownCategory =
      defaultToolCategories.includes(tool.category) ||
      customToolCategories.includes(tool.category) ||
      workspaceCategories.includes(tool.category) ||
      tool.category === "Uncategorized";

    setToolName(tool.name);
    setToolCategory(tool.category);
    setToolUrl(tool.pricingUrl === "#" ? "" : tool.pricingUrl);
    setIsCustomCategoryMode(!isKnownCategory);
    setEditingTool(tool);
    setHasSubmittedToolForm(false);
    setToolDataError("");
    setShowAddToolModal(true);
  };

  const openRoleQuestionModal = () => {
    setRoleQuestionChoice("");
    setShowRoleQuestionModal(true);
  };

  const openEditCategoryModal = () => {
    const activeCategories = workspaceCategories.length > 0 ? workspaceCategories : defaultToolCategories;
    setCategoryDrafts(activeCategories);
    setCategoryDeleteWarning(null);
    setNewCategoryName("");
    setShowEditCategoryModal(true);
  };

  const persistCategoryDrafts = (draftCategories: string[], options?: { closeModal?: boolean }) => {
    const previousCategories = workspaceCategories.length > 0 ? workspaceCategories : defaultToolCategories;
    const nextCategories = draftCategories
      .map((category) => normaliseToolCategory(category))
      .filter((category, index, categories) => category && categories.indexOf(category) === index);

    if (nextCategories.length === 0) return;

    const categoryMap = new Map<string, string>();
    previousCategories.forEach((category, index) => {
      const nextCategory = nextCategories[index];
      if (nextCategory && nextCategory !== category && !previousCategories.includes(nextCategory) && !nextCategories.includes(category)) {
        categoryMap.set(category, nextCategory);
      }
    });
    const deletedCategories = previousCategories.filter(
      (category) => !nextCategories.includes(category) && !categoryMap.has(category),
    );

    setWorkspaceCategories(nextCategories);
    setCustomToolCategories((currentCategories) =>
      Array.from(
        new Set([
          ...currentCategories.map((category) => categoryMap.get(category) ?? category),
          ...nextCategories.filter((category) => !defaultToolCategories.includes(category)),
        ]),
      ),
    );
    setToolList((currentTools) =>
      currentTools
        .filter((tool) => !deletedCategories.includes(tool.category))
        .map((tool) => ({
          ...tool,
          category: categoryMap.get(tool.category) ?? tool.category,
        })),
    );
    try {
      window.localStorage.setItem("ai-subprise-workspace-categories", JSON.stringify(nextCategories));
      window.localStorage.setItem("ai-subprise-tools-nav-open", "true");
    } catch {
      // Local storage can be unavailable in private or embedded browser contexts.
    }
    setIsToolsNavOpen(true);
    setCategoryDeleteWarning(null);
    if (options?.closeModal) {
      setShowEditCategoryModal(false);
    }
  };

  const addCategoryDraft = () => {
    const trimmedCategory = normaliseToolCategory(newCategoryName);
    if (!trimmedCategory) return;

    const nextCategories = categoryDrafts.includes(trimmedCategory)
      ? categoryDrafts
      : [...categoryDrafts, trimmedCategory];

    setCategoryDrafts(nextCategories);
    persistCategoryDrafts(nextCategories);
    setNewCategoryName("");
  };

  const deleteCategoryDraft = (index: number) => {
    const category = categoryDrafts[index];
    const affectedToolNames = toolList
      .filter((tool) => !tool.archived && tool.category === category)
      .map((tool) => tool.name);

    if (category && affectedToolNames.length > 0) {
      setCategoryDeleteWarning({
        category,
        index,
        toolCount: affectedToolNames.length,
      });
      return;
    }

    setCategoryDrafts((currentCategories) =>
      currentCategories.filter((_, categoryIndex) => categoryIndex !== index),
    );
  };

  const confirmCategoryDraftDelete = () => {
    if (!categoryDeleteWarning) return;

    setCategoryDrafts((currentCategories) =>
      currentCategories.filter((_, categoryIndex) => categoryIndex !== categoryDeleteWarning.index),
    );
    setCategoryDeleteWarning(null);
  };

  const updateCategoryDraft = (index: number, value: string) => {
    setCategoryDrafts((currentCategories) =>
      currentCategories.map((category, categoryIndex) =>
        categoryIndex === index ? formatNickname(value) : category,
      ),
    );
  };

  const moveCategoryDraft = (draggedIndex: number, targetIndex: number) => {
    if (draggedIndex === targetIndex) return;

    setCategoryDrafts((currentCategories) => {
      if (
        draggedIndex < 0 ||
        targetIndex < 0 ||
        draggedIndex >= currentCategories.length ||
        targetIndex >= currentCategories.length
      ) {
        return currentCategories;
      }

      const nextCategories = [...currentCategories];
      const [draggedCategory] = nextCategories.splice(draggedIndex, 1);
      nextCategories.splice(targetIndex, 0, draggedCategory);
      return nextCategories;
    });
    setDraggedCategoryIndex(targetIndex);
  };

  const handleCategoryDraftDragStart = (event: DragEvent<HTMLButtonElement>, index: number) => {
    setDraggedCategoryIndex(index);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  };

  const handleCategoryDraftPointerDown = (_event: PointerEvent<HTMLButtonElement>, index: number) => {
    setDraggedCategoryIndex(index);
  };

  const handleCategoryDraftDragEnter = (event: DragEvent<HTMLDivElement>, index: number) => {
    event.preventDefault();
    if (draggedCategoryIndex !== null && draggedCategoryIndex !== index) {
      moveCategoryDraft(draggedCategoryIndex, index);
    }
  };

  const handleCategoryDraftDrop = (event: DragEvent<HTMLDivElement>, index: number) => {
    event.preventDefault();
    if (draggedCategoryIndex !== null) moveCategoryDraft(draggedCategoryIndex, index);
    setDraggedCategoryIndex(null);
  };

  const saveEditedCategories = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    persistCategoryDrafts(categoryDrafts, { closeModal: true });
  };

  const createResetArchive = () => {
    if (toolList.length === 0) {
      return null;
    }

    const archive: ToolResetArchive = {
      id: `reset-${Date.now().toString(36)}`,
      userId: localUserId,
      createdAt: new Date().toISOString(),
      data: createResetBlob(toolList),
    };

    setToolResetArchives((currentArchives) => {
      const nextArchives = [archive, ...currentArchives].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      try {
        window.localStorage.setItem(resetArchiveStorageKey, JSON.stringify(nextArchives));
      } catch {
        // Local storage can be unavailable in private or embedded browser contexts.
      }
      return nextArchives;
    });
    setExpandedRecoveryIds((currentIds) => [archive.id, ...currentIds]);
    return archive;
  };

  const createDeletedToolsArchive = (items: ToolItem[]) => {
    if (items.length === 0) return null;

    const archive: ToolResetArchive = {
      id: `deleted-${Date.now().toString(36)}`,
      userId: localUserId,
      createdAt: new Date().toISOString(),
      data: createResetBlob(items),
    };

    setToolResetArchives((currentArchives) => {
      const nextArchives = [archive, ...currentArchives].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      try {
        window.localStorage.setItem(resetArchiveStorageKey, JSON.stringify(nextArchives));
      } catch {
        // Local storage can be unavailable in private or embedded browser contexts.
      }
      return nextArchives;
    });
    setExpandedRecoveryIds((currentIds) => [archive.id, ...currentIds]);
    return archive;
  };

  const openResetToolsFlow = () => {
    setShowResetTypeModal(true);
  };

  const continueResetAfterArchiveWarning = () => {
    setShowResetArchiveWarning(false);
    setShowResetTypeModal(true);
  };

  const applyReset = (mode: "blank" | "template") => {
    createResetArchive();
    setToolList([]);
    setActiveSection("tools");
    setActiveCategory("");
    setIsToolsNavOpen(true);
    try {
      window.localStorage.setItem("ai-subprise-tools-nav-open", "true");
    } catch {
      // Local storage can be unavailable in private or embedded browser contexts.
    }

    setWorkspaceCategories([]);
    try {
      window.localStorage.setItem("ai-subprise-workspace-categories", JSON.stringify([]));
    } catch {
      // Local storage can be unavailable in private or embedded browser contexts.
    }

    if (mode === "template") {
      setRoleQuestionChoice("");
      setShowRoleQuestionModal(true);
    }

    setShowResetTypeModal(false);
  };

  const requestResetConfirmation = (mode: "blank" | "template") => {
    setPendingResetMode(mode);
    setShowResetTypeModal(false);
    setShowResetDangerModal(true);
  };

  const confirmPendingReset = () => {
    if (!pendingResetMode) return;

    applyReset(pendingResetMode);
    setPendingResetMode(null);
    setShowResetDangerModal(false);
  };

  const openRestoreArchiveModal = () => {
    setShowRecoveryPanel(true);
  };

  const toggleRestoreTool = (toolId: string) => {
    setRestoreToolIds((currentToolIds) =>
      currentToolIds.includes(toolId)
        ? currentToolIds.filter((currentToolId) => currentToolId !== toolId)
        : [...currentToolIds, toolId],
    );
  };

  const persistResetArchives = (nextArchives: ToolResetArchive[]) => {
    setToolResetArchives(nextArchives);
    setExpandedRecoveryIds((currentIds) => currentIds.filter((id) => nextArchives.some((archive) => archive.id === id)));
    setSelectedRecoveryKeys((currentKeys) =>
      currentKeys.filter((key) => nextArchives.some((archive) => key.startsWith(`${archive.id}:`))),
    );
    if (nextArchives.length === 0) setShowRecoveryPanel(false);
    try {
      if (nextArchives.length > 0) {
        window.localStorage.setItem(resetArchiveStorageKey, JSON.stringify(nextArchives));
      } else {
        window.localStorage.removeItem(resetArchiveStorageKey);
      }
    } catch {
      // Local storage can be unavailable in private or embedded browser contexts.
    }
  };

  const removeRecoveryTools = (toolKeys: string[]) => {
    const keySet = new Set(toolKeys);
    const nextArchives = toolResetArchives
      .map((archive) => ({
        ...archive,
        data: archive.data
          .map((group) => ({
            ...group,
            tools: group.tools.filter((tool) => !keySet.has(`${archive.id}:${tool.id}`)),
          }))
          .filter((group) => group.tools.length > 0),
      }))
      .filter((archive) => archive.data.length > 0);

    persistResetArchives(nextArchives);
    setSelectedRecoveryKeys((currentKeys) => currentKeys.filter((currentKey) => !keySet.has(currentKey)));
  };

  const restoreSingleArchivedTool = (archiveId: string, toolId: string) => {
    const archive = toolResetArchives.find((currentArchive) => currentArchive.id === archiveId);
    if (!archive) return;

    const toolToRestore = archiveTools(archive).find((tool) => tool.id === toolId);
    if (!toolToRestore) return;
    const restoredTool = { ...toolToRestore, category: restoreCategory(toolToRestore.category, workspaceCategories) };

    if (!workspaceCategories.includes(restoredTool.category)) {
      const nextCategories = [...workspaceCategories, restoredTool.category];
      setWorkspaceCategories(nextCategories);
      try {
        window.localStorage.setItem("ai-subprise-workspace-categories", JSON.stringify(nextCategories));
      } catch {
        // Local storage can be unavailable in private or embedded browser contexts.
      }
    }

    setToolList((currentTools) => {
      if (currentTools.some((tool) => tool.id === toolId)) return currentTools;
      return [...currentTools, restoredTool];
    });
    removeRecoveryTools([`${archiveId}:${toolId}`]);
  };

  const deleteSingleArchivedTool = (archiveId: string, toolId: string) => {
    removeRecoveryTools([`${archiveId}:${toolId}`]);
    showToast("Gone for good.");
  };

  const toggleRecoveryTool = (archiveId: string, toolId: string) => {
    const key = `${archiveId}:${toolId}`;
    setSelectedRecoveryKeys((currentKeys) =>
      currentKeys.includes(key)
        ? currentKeys.filter((currentKey) => currentKey !== key)
        : [...currentKeys, key],
    );
  };

  const toggleRecoveryGroup = (archiveId: string) => {
    setExpandedRecoveryIds((currentIds) =>
      currentIds.includes(archiveId)
        ? currentIds.filter((currentId) => currentId !== archiveId)
        : [...currentIds, archiveId],
    );
  };

  const restoreSelectedRecoveryTools = (archiveId?: string, explicitSelectedKeys?: string[]) => {
    const targetArchives = archiveId
      ? toolResetArchives.filter((currentArchive) => currentArchive.id === archiveId)
      : toolResetArchives;
    if (targetArchives.length === 0) return;

    const selectedKeys = archiveId
      ? selectedRecoveryKeys.filter((key) => key.startsWith(`${archiveId}:`))
      : explicitSelectedKeys ?? selectedRecoveryKeys;
    if (selectedKeys.length === 0) return;

    const selectedKeySet = new Set(selectedKeys);
    const selectedTools = targetArchives.flatMap((archive) =>
      archiveTools(archive)
        .filter((tool) => selectedKeySet.has(`${archive.id}:${tool.id}`))
        .map((tool) => ({ ...tool, category: restoreCategory(tool.category, workspaceCategories) })),
    );

    const missingCategories = Array.from(
      new Set(selectedTools.map((tool) => tool.category).filter((category) => !workspaceCategories.includes(category))),
    );
    if (missingCategories.length > 0) {
      const nextCategories = [...workspaceCategories, ...missingCategories];
      setWorkspaceCategories(nextCategories);
      try {
        window.localStorage.setItem("ai-subprise-workspace-categories", JSON.stringify(nextCategories));
      } catch {
        // Local storage can be unavailable in private or embedded browser contexts.
      }
    }

    setToolList((currentTools) => {
      const activeToolIds = new Set(currentTools.map((tool) => tool.id));
      return [...currentTools, ...selectedTools.filter((tool) => !activeToolIds.has(tool.id))];
    });
    removeRecoveryTools(selectedKeys);
  };

  const restoreArchivedTools = () => {
    if (toolResetArchives.length === 0) return;

    const selectedToolSet = new Set(restoreToolIds);
    const selectedTools = toolResetArchives.flatMap((archive) =>
      archiveTools(archive)
        .filter((tool) => selectedToolSet.has(tool.id))
        .map((tool) => ({ ...tool, category: restoreCategory(tool.category, workspaceCategories) })),
    );

    setToolList((currentTools) => {
      const activeToolIds = new Set(currentTools.map((tool) => tool.id));
      return [...currentTools, ...selectedTools.filter((tool) => !activeToolIds.has(tool.id))];
    });

    removeRecoveryTools(
      toolResetArchives.flatMap((archive) =>
        archiveTools(archive)
          .filter((tool) => selectedToolSet.has(tool.id))
          .map((tool) => `${archive.id}:${tool.id}`),
      ),
    );

    setRestoreToolIds([]);
    setShowRestoreArchiveModal(false);
  };

  const chooseRoleAndPreview = (role: RoleOption) => {
    setRoleQuestionChoice(role);
    setSelectedRole(role);
    setSelectedRoleCategories(roleCategoryMap[role]);
    setShowRoleQuestionModal(false);
    setShowCategoryPreviewModal(true);
  };

  const switchPreviewRole = (role: RoleOption) => {
    setSelectedRole(role);
    setSelectedRoleCategories(roleCategoryMap[role]);
  };

  const togglePreviewCategory = (category: string) => {
    setSelectedRole("Custom");
    setSelectedRoleCategories((currentCategories) =>
      currentCategories.includes(category)
        ? currentCategories.filter((currentCategory) => currentCategory !== category)
        : [...currentCategories, category],
    );
  };

  const saveRoleCategories = () => {
    const nextCategories = defaultToolCategories.filter((category) => selectedRoleCategories.includes(category));
    const confirmedCategories = nextCategories.length > 0 ? nextCategories : ["AI Assistant"];
    setWorkspaceCategories(confirmedCategories);
    setActiveSection("tools");
    setActiveCategory("");
    setSelectedToolSort("Category");
    setIsToolsNavOpen(true);
    try {
      window.localStorage.setItem("ai-subprise-workspace-categories", JSON.stringify(confirmedCategories));
      window.localStorage.setItem("ai-subprise-tools-nav-open", "true");
    } catch {
      // Local storage can be unavailable in private or embedded browser contexts.
    }
    setShowCategoryPreviewModal(false);
  };

  const saveAccount = async (event?: FormEvent<HTMLFormElement>, options?: { addAnother?: boolean }) => {
    event?.preventDefault();
    setHasSubmittedAccountForm(true);
    setAccountDataError("");

    const trimmedNickname = nickname.trim();
    const trimmedProvider = providerRef.current.trim();
    const trimmedLogin = login.trim();
    const loginFeedback = validateLogin(trimmedProvider, login);
    const isDuplicateNickname = accountList.some(
      (account) =>
        account.login !== editingAccount?.login &&
        account.label.trim().toLowerCase() === trimmedNickname.toLowerCase(),
    );
    const isDuplicateLogin = accountList.some(
      (account) =>
        account.login !== editingAccount?.login &&
        account.login.trim().toLowerCase() === trimmedLogin.toLowerCase(),
    );

    const isNicknameTooLong = trimmedNickname.length > accountNicknameMaxLength;

    if (
      !trimmedNickname ||
      !trimmedProvider ||
      !trimmedLogin ||
      loginFeedback?.type === "error" ||
      isDuplicateNickname ||
      isDuplicateLogin ||
      isNicknameTooLong
    ) return;

    const accountDetails: Account = {
      id: editingAccount?.id,
      label: trimmedNickname,
      provider: trimmedProvider,
      login: trimmedLogin,
      tag: selectedColour.tag,
      linked: editingAccount?.linked ?? 0,
    };

    const persistAccount = async () => {
      if (!shouldUseSupabase) return accountDetails;

      const payload = accountToInput(accountDetails);
      const savedRecord =
        editingAccount?.id
          ? await updateAccountRecord(editingAccount.id, payload)
          : await createAccountRecord(payload);

      return {
        ...accountFromRecord(savedRecord),
        linked: editingAccount?.linked ?? 0,
      };
    };

    if (!defaultProviders.includes(trimmedProvider)) {
      setCustomProviders((currentProviders) =>
        currentProviders.includes(trimmedProvider) ? currentProviders : [...currentProviders, trimmedProvider],
      );
    }

    setIsSavingAccount(true);
    let savedAccount: Account;
    try {
      savedAccount = await persistAccount();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save account.";
      setAccountDataError(message);
      setIsSavingAccount(false);
      return;
    }
    setIsSavingAccount(false);

    setAccountList((currentAccounts) =>
      editingAccount
        ? currentAccounts.map((account) =>
            (editingAccount.id ? account.id === editingAccount.id : account.login === editingAccount.login)
              ? savedAccount
              : account,
          )
        : [...currentAccounts, savedAccount],
    );
    setHasSubmittedAccountForm(false);
    showToast(
      editingAccount
        ? "✅ Account updated."
        : options?.addAnother
          ? "✅ Account added. Keep going."
          : "✅ Account added.",
    );

    if (options?.addAnother && !editingAccount) {
      setNickname("");
      setHasAttemptedNicknameOverflow(false);
      setLogin("");
      setSelectedColour(colourOptions[0]);
      updateAccountProvider(trimmedProvider);
      setIsCustomProviderMode(false);
      setIsColourMenuOpen(false);
      window.setTimeout(() => nicknameInputRef.current?.focus(), 0);
      return;
    }

    setEditingAccount(null);
    setIsCustomProviderMode(false);
    setShowAddAccountModal(false);
  };

  const insertToolAlphabetically = (currentTools: ToolItem[], toolDetails: ToolItem) => {
    const nextTools = [...currentTools];
    const firstLaterToolIndex = nextTools.findIndex(
      (tool) =>
        tool.category === toolDetails.category &&
        tool.name.localeCompare(toolDetails.name, undefined, { sensitivity: "base" }) > 0,
    );

    if (firstLaterToolIndex >= 0) {
      nextTools.splice(firstLaterToolIndex, 0, toolDetails);
      return nextTools;
    }

    const lastSameCategoryIndex = nextTools.reduce(
      (lastIndex, tool, index) => (tool.category === toolDetails.category ? index : lastIndex),
      -1,
    );

    if (lastSameCategoryIndex >= 0) {
      nextTools.splice(lastSameCategoryIndex + 1, 0, toolDetails);
      return nextTools;
    }

    return [...nextTools, toolDetails];
  };

  const saveTool = async (event?: FormEvent<HTMLFormElement>, options?: { addAnother?: boolean }) => {
    event?.preventDefault();
    setHasSubmittedToolForm(true);
    setToolDataError("");

    const trimmedToolName = toolName.trim();
    const trimmedCategory = normaliseToolCategory(toolCategory);
    const isDuplicateToolName = toolList.some(
      (tool) =>
        tool.id !== editingTool?.id &&
        tool.name.trim().toLowerCase() === trimmedToolName.toLowerCase(),
    );

    if (!trimmedToolName || !trimmedCategory || isDuplicateToolName) return;

    if (!defaultToolCategories.includes(trimmedCategory)) {
      setCustomToolCategories((currentCategories) =>
        currentCategories.includes(trimmedCategory) ? currentCategories : [...currentCategories, trimmedCategory],
      );
    }

    const nextWorkspaceCategories = workspaceCategories.includes(trimmedCategory)
      ? workspaceCategories
      : [...workspaceCategories, trimmedCategory];

    if (nextWorkspaceCategories !== workspaceCategories) {
      setWorkspaceCategories(nextWorkspaceCategories);
      setIsToolsNavOpen(true);
      try {
        window.localStorage.setItem("ai-subprise-workspace-categories", JSON.stringify(nextWorkspaceCategories));
        window.localStorage.setItem("ai-subprise-tools-nav-open", "true");
      } catch {
        // Local storage can be unavailable in private or embedded browser contexts.
      }
    }

    const toolDetails: ToolItem = {
      id: editingTool?.id ?? createToolId(trimmedToolName),
      name: trimmedToolName,
      category: trimmedCategory,
      status: editingTool?.status ?? "Free",
      accounts: editingTool?.accounts ?? [],
      billing: editingTool?.billing ?? "None",
      notes: editingTool?.notes ?? "",
      favorite: editingTool?.favorite ?? false,
      archived: editingTool?.archived ?? false,
      pricingUrl: toolUrl.trim() || "#",
      logo: toolInitials(trimmedToolName),
      logoBg: editingTool?.logoBg ?? "#F0F4FF",
    };

    const persistTool = async () => {
      if (!shouldUseSupabase) return toolDetails;

      const savedRecord = editingTool
        ? await updateToolRecord(editingTool.id, toolToInput(toolDetails), accountList)
        : await createToolRecord(toolToInput(toolDetails), accountList);

      return toolFromRecord(savedRecord);
    };

    setIsSavingTool(true);
    let savedTool: ToolItem;
    try {
      savedTool = await persistTool();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save AI tool.";
      setToolDataError(message);
      setIsSavingTool(false);
      return;
    }
    setIsSavingTool(false);

    setToolList((currentTools) =>
      editingTool
        ? currentTools.map((tool) => (tool.id === editingTool.id ? savedTool : tool))
        : insertToolAlphabetically(currentTools, savedTool),
    );
    setEditingTool(null);
    setIsCustomCategoryMode(false);
    setHasSubmittedToolForm(false);

    if (options?.addAnother && !editingTool) {
      setToolName("");
      setToolCategory(trimmedCategory);
      setToolUrl("");
      window.setTimeout(() => toolNameInputRef.current?.focus(), 0);
      return;
    }

    setShowAddToolModal(false);
  };

  const openEditProviderModal = (providerNameToEdit: string) => {
    setEditingProvider(providerNameToEdit);
    setProviderName(providerNameToEdit);
  };

  const saveProviderName = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();

    if (!editingProvider) return;

    const trimmedProviderName = providerName.trim();
    if (!trimmedProviderName) return;

    const hasProviderNameChanged = trimmedProviderName !== editingProvider;

    setCustomProviders((currentProviders) =>
      currentProviders.map((currentProvider) =>
        currentProvider === editingProvider ? trimmedProviderName : currentProvider,
      ),
    );
    setAccountList((currentAccounts) =>
      currentAccounts.map((account) =>
        account.provider === editingProvider ? { ...account, provider: trimmedProviderName } : account,
      ),
    );
    setEditingProvider(null);
    setProviderName("");
    if (hasProviderNameChanged) {
      showToast("✅ Provider updated.");
    }
  };

  const deleteProvider = () => {
    if (!deletingProvider) return;

    setCustomProviders((currentProviders) =>
      currentProviders.filter((currentProvider) => currentProvider !== deletingProvider),
    );
    setAccountList((currentAccounts) =>
      currentAccounts.filter((account) => account.provider !== deletingProvider),
    );
    setDeletingProvider(null);
    setEditingProvider(null);
    setProviderName("");
  };

  const moveAccount = (draggedLogin: string, targetLogin: string) => {
    if (draggedLogin === targetLogin) return;

    setAccountList((currentAccounts) => {
      const draggedIndex = currentAccounts.findIndex((account) => account.login === draggedLogin);
      const targetIndex = currentAccounts.findIndex((account) => account.login === targetLogin);

      if (draggedIndex < 0 || targetIndex < 0) return currentAccounts;

      const nextAccounts = [...currentAccounts];
      const [draggedAccount] = nextAccounts.splice(draggedIndex, 1);
      nextAccounts.splice(targetIndex, 0, draggedAccount);
      return nextAccounts;
    });
  };

  const handleAccountDragStart = (event: DragEvent<HTMLButtonElement>, account: Account) => {
    setDraggedAccountLogin(account.login);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", account.login);
  };

  const handleAccountPointerDown = (event: PointerEvent<HTMLButtonElement>, account: Account) => {
    event.preventDefault();
    setDraggedAccountLogin(account.login);
  };

  const handleAccountDrop = (event: DragEvent<HTMLDivElement>, account: Account) => {
    event.preventDefault();
    if (draggedAccountLogin) moveAccount(draggedAccountLogin, account.login);
    setDraggedAccountLogin(null);
  };

  const moveTool = (draggedName: string, targetName: string) => {
    if (draggedName === targetName) return;

    setHasCustomToolOrder(true);
    try {
      window.localStorage.setItem(toolOrderPreferenceStorageKey, "custom");
    } catch {
      // Local storage can be unavailable in private or embedded browser contexts.
    }

    setToolList((currentTools) => {
      const draggedIndex = currentTools.findIndex((tool) => tool.name === draggedName);
      const targetIndex = currentTools.findIndex((tool) => tool.name === targetName);

      if (draggedIndex < 0 || targetIndex < 0) return currentTools;

      const nextTools = [...currentTools];
      const [draggedTool] = nextTools.splice(draggedIndex, 1);
      nextTools.splice(targetIndex, 0, draggedTool);
      return nextTools;
    });
  };

  const handleToolDragStart = (event: DragEvent<HTMLButtonElement>, toolName: string) => {
    setDraggedToolName(toolName);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", toolName);
  };

  const handleToolPointerDown = (event: PointerEvent<HTMLButtonElement>, toolName: string) => {
    event.preventDefault();
    setDraggedToolName(toolName);
  };

  const handleToolDrop = (event: DragEvent<HTMLElement>, toolName: string) => {
    event.preventDefault();
    if (draggedToolName) moveTool(draggedToolName, toolName);
    setDraggedToolName(null);
  };

  const toggleToolFavorite = async (toolName: string) => {
    const targetTool = toolList.find((tool) => tool.name === toolName);
    if (!targetTool) return;

    const nextFavorite = !targetTool.favorite;
    setToolDataError("");
    setToolList((currentTools) =>
      currentTools.map((tool) =>
        tool.name === toolName ? { ...tool, favorite: nextFavorite } : tool,
      ),
    );

    if (!shouldUseSupabase) return;

    try {
      await patchToolRecord(targetTool.id, { favorite: nextFavorite });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not update favourite.";
      setToolDataError(message);
      setToolList((currentTools) =>
        currentTools.map((tool) =>
          tool.id === targetTool.id ? { ...tool, favorite: targetTool.favorite } : tool,
        ),
      );
    }
  };

  const toggleToolWatchlist = async (toolId: string) => {
    const targetTool = toolList.find((tool) => tool.id === toolId);
    if (!targetTool) return;

    const nextStatus: ToolStatus = targetTool.status === "Considering" ? "Active" : "Considering";
    setToolDataError("");
    setToolList((currentTools) =>
      currentTools.map((tool) =>
        tool.id === toolId ? { ...tool, status: nextStatus } : tool,
      ),
    );

    if (!shouldUseSupabase) return;

    try {
      await patchToolRecord(targetTool.id, { status: nextStatus });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not update watchlist.";
      setToolDataError(message);
      setToolList((currentTools) =>
        currentTools.map((tool) =>
          tool.id === targetTool.id ? { ...tool, status: targetTool.status } : tool,
        ),
      );
    }
  };

  const confirmPendingToolStateChange = async () => {
    if (!confirmToolStateChange) return;

    if (confirmToolStateChange.action === "unfavorite") {
      setToolList((currentTools) =>
        currentTools.map((tool) =>
          tool.id === confirmToolStateChange.tool.id ? { ...tool, favorite: false } : tool,
        ),
      );
      showToast("✅ Removed from Favourites.");
    }

    if (confirmToolStateChange.action === "unarchive") {
      unarchiveToolIds([confirmToolStateChange.tool.id]);
      showToast(`✅ ${confirmToolStateChange.tool.name} is back.`);
    }

    setConfirmToolStateChange(null);
  };

  const confirmMoveWatchlistToolToLinked = () => {
    if (!watchlistMoveTool) return;

    setActiveSection("linked");
    setActiveCategory("");
    openLinkToolModal(watchlistMoveTool, { activateToolOnSave: true });
    setWatchlistMoveTool(null);
  };

  const toggleToolSelection = (toolId: string) => {
    setSelectedToolIds((currentIds) =>
      currentIds.includes(toolId)
        ? currentIds.filter((currentId) => currentId !== toolId)
        : [...currentIds, toolId],
    );
  };

  const clearToolSelection = () => {
    setSelectedToolIds([]);
  };

  const toggleToolExpanded = (toolId: string) => {
    setExpandedToolIds((currentIds) =>
      currentIds.includes(toolId)
        ? currentIds.filter((currentId) => currentId !== toolId)
        : [...currentIds, toolId],
    );
  };

  const relationStatus = (tool: ToolItem, accountLabel: string): ToolStatus => {
    const status = toolAccountStatuses[tool.id]?.[accountLabel] ?? tool.status;
    if (status === "Paid") return "Active";
    if (status === "Free") return "Free Tier";
    return status;
  };

  const updateRelationStatus = async (toolId: string, accountLabel: string, nextStatus: ToolStatus) => {
    setToolAccountStatuses((currentStatuses) => ({
      ...currentStatuses,
      [toolId]: {
        ...(currentStatuses[toolId] ?? {}),
        [accountLabel]: nextStatus,
      },
    }));

    if (!shouldUseSupabase) return;

    try {
      await updateToolLinkDetails(toolId, accountLabel, accountList, { plan: nextStatus });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not update plan.";
      setToolDataError(message);
    }
  };

  const planKeyForStatus = (status: ToolStatus): PlanKey => {
    if (status === "Trial") return "trial";
    if (status === "Active" || status === "Paid") return "paid";
    return "free";
  };

  const statusForPlanKey = (planKey: PlanKey): ToolStatus => {
    if (planKey === "trial") return "Trial";
    if (planKey === "paid") return "Active";
    return "Free Tier";
  };

  const isPlanAllowedForTool = (tool: ToolItem | undefined, status: ToolStatus) => {
    const allowedPlans = tool ? toolCustomizationFor(tool.name)?.allowedPlans : undefined;
    return !allowedPlans?.length || allowedPlans.includes(planKeyForStatus(status));
  };

  const renderPlanSelector = (value: ToolStatus, onChange: (nextPlan: ToolStatus) => void, tool?: ToolItem) => {
    const customization = tool ? toolCustomizationFor(tool.name) : undefined;
    const allowedPlans = customization?.allowedPlans;
    const planOptions = [
      { key: "free" as PlanKey, label: "Free", value: "Free Tier" as ToolStatus },
      { key: "trial" as PlanKey, label: "Trial", value: "Trial" as ToolStatus },
      { key: "paid" as PlanKey, label: "Paid", value: "Active" as ToolStatus },
    ];
    const hasLockedPlans = Boolean(allowedPlans?.length);

    return (
      <>
        <div className="plan-selector" role="group" aria-label="Plan">
          {planOptions.map((plan) => {
            const isDisabled = Boolean(allowedPlans && !allowedPlans.includes(plan.key));

            return (
              <button
                aria-disabled={isDisabled}
                className={
                  value === plan.value
                    ? `plan-selector-pill plan-${plan.label.toLowerCase()} is-selected`
                    : `plan-selector-pill plan-${plan.label.toLowerCase()}`
                }
                disabled={isDisabled}
                key={plan.value}
                onClick={() => onChange(plan.value)}
                title={isDisabled ? customization?.planLockedReason : undefined}
                type="button"
              >
                {plan.label}
              </button>
            );
          })}
        </div>
        {hasLockedPlans && customization?.planLockedReason ? (
          <small className="field-feedback neutral">{customization.planLockedReason}</small>
        ) : null}
      </>
    );
  };

  const resetLinkToolBlocks = () => {
    setLinkToolAccountBlocks([{ accountLabel: "", id: "link-account-1", plan: "Free Tier", planName: "" }]);
  };

  const closeLinkToolModal = () => {
    setShowLinkToolModal(false);
    setLinkToolId("");
    resetLinkToolBlocks();
    setLinkToolSearchQuery("");
    setIsLinkToolPickerOpen(false);
    setIsLinkToolLocked(false);
    setLinkToolActivateToolId("");
  };

  const openLinkToolModal = (tool?: ToolItem, options?: { activateToolOnSave?: boolean }) => {
    setLinkToolId(tool?.id ?? "");
    resetLinkToolBlocks();
    setLinkToolSearchQuery(tool?.name ?? "");
    setIsLinkToolPickerOpen(false);
    setOpenDropdownId(null);
    setIsLinkToolLocked(Boolean(tool));
    setLinkToolActivateToolId(options?.activateToolOnSave && tool ? tool.id : "");
    setShowLinkToolModal(true);
  };

  const openManageAccountModal = (tool: ToolItem, accountLabel: string) => {
    const details = toolAccountDetails[tool.id]?.[accountLabel];

    setManagingLink({ accountLabel, toolId: tool.id });
    setManagedAccountLabel(accountLabel);
    setManagedPlan(relationPlanStatusValue(tool, accountLabel));
    setManagedPlanName(details?.planName ?? toolAccountPlanNames[tool.id]?.[accountLabel] ?? "");
    setManagedBillingType(normaliseBillingType(details?.billingType ?? "Monthly"));
    const selectedBillingTypes = normaliseBillingType(details?.billingType ?? "Monthly").split(", ").filter(Boolean);
    setManagedBillingAmounts(
      details?.billingAmounts?.length
        ? details.billingAmounts
        : selectedBillingTypes.map((billingType, index) => ({
            amount: index === 0 ? details?.amount ?? "" : "",
            billingType,
            currency: normaliseCurrency(details?.currency ?? defaultCurrency),
          })),
    );
    setManagedNextChargeDate(details?.nextChargeDate ?? "");
    setManagedTrialExpiryDate(details?.trialExpiryDate ?? "");
    setManagedStatus(details?.status ?? "Active");
  };

  const closeManageAccountModal = () => {
    setManagingLink(null);
    setManagedAccountLabel("");
    setManagedPlan("Free Tier");
    setManagedPlanName("");
    setManagedBillingType("Monthly");
    setManagedBillingAmounts([{ amount: "", billingType: "Monthly", currency: defaultCurrency }]);
    setManagedNextChargeDate("");
    setManagedTrialExpiryDate("");
    setManagedStatus("Active");
  };

  const saveManagedAccount = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!managingLink || !managedAccountLabel) return;

    const { accountLabel: previousAccountLabel, toolId } = managingLink;
    const selectedTool = toolList.find((tool) => tool.id === toolId);
    if (!selectedTool) return;

    const isSwitchingToExistingLink =
      managedAccountLabel !== previousAccountLabel && selectedTool.accounts.includes(managedAccountLabel);
    if (isSwitchingToExistingLink) return;

    const previousTools = toolList;
    const nextAccounts = selectedTool.accounts.map((account) =>
      account === previousAccountLabel ? managedAccountLabel : account,
    );
    setToolList((currentTools) =>
      currentTools.map((tool) => {
        if (tool.id !== toolId) return tool;

        return {
          ...tool,
          accounts: tool.accounts.map((account) =>
            account === previousAccountLabel ? managedAccountLabel : account,
          ),
        };
      }),
    );

    setToolAccountStatuses((currentStatuses) => {
      const nextStatuses = { ...currentStatuses };
      const nextToolStatuses = { ...(nextStatuses[toolId] ?? {}) };
      if (managedAccountLabel !== previousAccountLabel) {
        delete nextToolStatuses[previousAccountLabel];
      }
      nextToolStatuses[managedAccountLabel] = managedPlan;
      nextStatuses[toolId] = nextToolStatuses;
      return nextStatuses;
    });

    setToolAccountPlanNames((currentPlanNames) => {
      const nextPlanNames = { ...currentPlanNames };
      const nextToolPlanNames = { ...(nextPlanNames[toolId] ?? {}) };
      if (managedAccountLabel !== previousAccountLabel) {
        delete nextToolPlanNames[previousAccountLabel];
      }
      nextToolPlanNames[managedAccountLabel] = managedPlan === "Active" ? managedPlanName.trim() : "";
      nextPlanNames[toolId] = nextToolPlanNames;
      return nextPlanNames;
    });

    setToolAccountDetails((currentDetails) => {
      const nextDetails = { ...currentDetails };
      const nextToolDetails = { ...(nextDetails[toolId] ?? {}) };
      if (managedAccountLabel !== previousAccountLabel) {
        delete nextToolDetails[previousAccountLabel];
      }
      nextToolDetails[managedAccountLabel] = {
        amount: managedPlan === "Active" ? managedBillingAmounts[0]?.amount.trim() ?? "" : "",
        billingAmounts: managedPlan === "Active" ? managedBillingAmounts : [],
        billingType: managedBillingType,
        currency: normaliseCurrency(managedBillingAmounts[0]?.currency),
        nextChargeDate: managedPlan === "Active" ? managedNextChargeDate : "",
        planName: managedPlan === "Active" ? managedPlanName.trim() : "",
        status: managedStatus,
        trialExpiryDate: managedPlan === "Trial" ? managedTrialExpiryDate : "",
      };
      nextDetails[toolId] = nextToolDetails;
      return nextDetails;
    });

    if (shouldUseSupabase) {
      try {
        await replaceToolLinks(toolId, nextAccounts, accountList);
        await updateToolLinkDetails(toolId, managedAccountLabel, accountList, {
          amount: managedPlan === "Active" ? managedBillingAmounts[0]?.amount.trim() ?? "" : "",
          billingType: managedBillingType,
          currency: normaliseCurrency(managedBillingAmounts[0]?.currency),
          nextChargeDate: managedPlan === "Active" ? managedNextChargeDate : "",
          plan: managedPlan,
          planName: managedPlan === "Active" ? managedPlanName.trim() : "",
          status: managedStatus,
          trialExpiryDate: managedPlan === "Trial" ? managedTrialExpiryDate : "",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not update linked account.";
        setToolDataError(message);
        setToolList(previousTools);
        return;
      }
    }

    closeManageAccountModal();
  };

  const openBillingEditModal = (toolId: string, accountLabel: string) => {
    const detail = toolAccountDetails[toolId]?.[accountLabel];

    setEditingBillingLink({ accountLabel, toolId });
    setBillingPlanName(detail?.planName ?? toolAccountPlanNames[toolId]?.[accountLabel] ?? "");
    setBillingBillingType(normaliseBillingType(detail?.billingType ?? "Monthly"));
    setBillingCurrency(normaliseCurrency(detail?.currency ?? defaultCurrency));
    setBillingAmount(detail?.amount ?? "");
    setBillingNextChargeDate(detail?.nextChargeDate ?? "");
  };

  const closeBillingEditModal = () => {
    setEditingBillingLink(null);
    setBillingPlanName("");
    setBillingBillingType("Monthly");
    setBillingCurrency("USD");
    setBillingAmount("");
    setBillingNextChargeDate("");
  };

  const saveBillingDetails = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!editingBillingLink) return;

    const { accountLabel, toolId } = editingBillingLink;
    const previousDetails = toolAccountDetails;
    const nextDetail: ToolAccountDetail = {
      amount: billingAmount.trim(),
      billingType: billingBillingType,
      currency: normaliseCurrency(billingCurrency),
      nextChargeDate: billingNextChargeDate,
      planName: billingPlanName.trim(),
      status: toolAccountDetails[toolId]?.[accountLabel]?.status ?? "Active",
      trialExpiryDate: toolAccountDetails[toolId]?.[accountLabel]?.trialExpiryDate ?? "",
    };

    setToolAccountDetails((currentDetails) => ({
      ...currentDetails,
      [toolId]: {
        ...(currentDetails[toolId] ?? {}),
        [accountLabel]: nextDetail,
      },
    }));
    setToolAccountPlanNames((currentPlanNames) => ({
      ...currentPlanNames,
      [toolId]: {
        ...(currentPlanNames[toolId] ?? {}),
        [accountLabel]: billingPlanName.trim(),
      },
    }));

    if (shouldUseSupabase) {
      try {
        await updateToolLinkDetails(toolId, accountLabel, accountList, {
          amount: nextDetail.amount,
          billingType: nextDetail.billingType,
          currency: nextDetail.currency,
          nextChargeDate: nextDetail.nextChargeDate,
          plan: "Active",
          planName: nextDetail.planName,
          status: nextDetail.status,
          trialExpiryDate: "",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not update billing details.";
        setToolDataError(message);
        setToolAccountDetails(previousDetails);
        return;
      }
    }

    closeBillingEditModal();
  };

  const updateBillingField = async (
    toolId: string,
    accountLabel: string,
    patch: Partial<Pick<ToolAccountDetail, "amount" | "billingType" | "currency" | "nextChargeDate" | "planName">>,
  ) => {
    const currentDetail = toolAccountDetails[toolId]?.[accountLabel];
    const nextDetail: ToolAccountDetail = {
      amount: patch.amount ?? currentDetail?.amount ?? "",
      billingAmounts: currentDetail?.billingAmounts,
      billingType: normaliseBillingType(patch.billingType ?? currentDetail?.billingType ?? "Monthly"),
      currency: normaliseCurrency(patch.currency ?? currentDetail?.currency),
      nextChargeDate: patch.nextChargeDate ?? currentDetail?.nextChargeDate ?? "",
      planName: patch.planName ?? currentDetail?.planName ?? toolAccountPlanNames[toolId]?.[accountLabel] ?? "",
      status: currentDetail?.status ?? "Active",
      trialExpiryDate: currentDetail?.trialExpiryDate ?? "",
    };
    const previousDetails = toolAccountDetails;
    const previousPlanNames = toolAccountPlanNames;

    setToolAccountDetails((currentDetails) => ({
      ...currentDetails,
      [toolId]: {
        ...(currentDetails[toolId] ?? {}),
        [accountLabel]: nextDetail,
      },
    }));

    if (patch.planName !== undefined) {
      setToolAccountPlanNames((currentPlanNames) => ({
        ...currentPlanNames,
        [toolId]: {
          ...(currentPlanNames[toolId] ?? {}),
          [accountLabel]: nextDetail.planName,
        },
      }));
    }

    if (shouldUseSupabase) {
      try {
        await updateToolLinkDetails(toolId, accountLabel, accountList, {
          amount: nextDetail.amount,
          billingType: nextDetail.billingType,
          currency: nextDetail.currency,
          nextChargeDate: nextDetail.nextChargeDate,
          plan: "Active",
          planName: nextDetail.planName,
          status: nextDetail.status,
          trialExpiryDate: "",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not update billing details.";
        setToolDataError(message);
        setToolAccountDetails(previousDetails);
        setToolAccountPlanNames(previousPlanNames);
      }
    }
  };

  const saveToolLink = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const selectedTool = toolList.find((tool) => tool.id === linkToolId);

    const filledBlocks = linkToolAccountBlocks.filter((block) => block.accountLabel && block.plan);
    const selectedAccountLabels = filledBlocks.map((block) => block.accountLabel);
    const hasDuplicateSelection = new Set(selectedAccountLabels).size !== selectedAccountLabels.length;
    const hasExistingLink = selectedAccountLabels.some((accountLabel) => selectedTool?.accounts.includes(accountLabel));

    if (!selectedTool || filledBlocks.length !== linkToolAccountBlocks.length || hasDuplicateSelection || hasExistingLink) return;

    const previousTools = toolList;
    const nextAccounts = Array.from(new Set([...selectedTool.accounts, ...selectedAccountLabels]));
    const shouldActivateTool = linkToolActivateToolId === selectedTool.id;
    setToolList((currentTools) =>
      currentTools.map((tool) =>
        tool.id === selectedTool.id
          ? { ...tool, accounts: nextAccounts, status: shouldActivateTool ? "Active" : tool.status }
          : tool,
      ),
    );
    setToolAccountStatuses((currentStatuses) => ({
      ...currentStatuses,
      [selectedTool.id]: filledBlocks.reduce(
        (nextStatuses, block) => ({
          ...nextStatuses,
          [block.accountLabel]: block.plan,
        }),
        { ...(currentStatuses[selectedTool.id] ?? {}) },
      ),
    }));
    setToolAccountPlanNames((currentPlanNames) => ({
      ...currentPlanNames,
      [selectedTool.id]: filledBlocks.reduce(
        (nextPlanNames, block) => ({
          ...nextPlanNames,
          [block.accountLabel]: block.plan === "Active" ? block.planName.trim() : "",
        }),
        { ...(currentPlanNames[selectedTool.id] ?? {}) },
      ),
    }));
    setToolAccountDetails((currentDetails) => ({
      ...currentDetails,
      [selectedTool.id]: filledBlocks.reduce(
        (nextDetails, block) => ({
          ...nextDetails,
          [block.accountLabel]: {
            amount: "",
            billingType: "Monthly",
            currency: "USD",
            nextChargeDate: "",
            planName: block.plan === "Active" ? block.planName.trim() : "",
            status: "Active",
            trialExpiryDate: "",
          },
        }),
        { ...(currentDetails[selectedTool.id] ?? {}) },
      ),
    }));
    if (shouldUseSupabase) {
      try {
        await replaceToolLinks(selectedTool.id, nextAccounts, accountList);
        await Promise.all(
          filledBlocks.map((block) =>
            updateToolLinkDetails(selectedTool.id, block.accountLabel, accountList, {
              billingType: "Monthly",
              currency: "USD",
              nextChargeDate: "",
              plan: block.plan,
              planName: block.plan === "Active" ? block.planName.trim() : "",
              status: "Active",
            }),
          ),
        );
        if (shouldActivateTool) {
          await patchToolRecord(selectedTool.id, { status: "Active" });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not link AI tool.";
        setToolDataError(message);
        setToolList(previousTools);
        return;
      }
    }
    closeLinkToolModal();
  };

  const removeLinkedAccount = async (toolId: string, accountLabel: string) => {
    const targetTool = toolList.find((tool) => tool.id === toolId);
    const previousTools = toolList;
    const nextAccounts = targetTool?.accounts.filter((account) => account !== accountLabel) ?? [];
    setToolList((currentTools) =>
      currentTools.map((tool) =>
        tool.id === toolId
          ? { ...tool, accounts: tool.accounts.filter((account) => account !== accountLabel) }
          : tool,
      ),
    );
    setToolAccountStatuses((currentStatuses) => {
      const nextStatuses = { ...currentStatuses };
      const nextToolStatuses = { ...(nextStatuses[toolId] ?? {}) };
      delete nextToolStatuses[accountLabel];
      nextStatuses[toolId] = nextToolStatuses;
      return nextStatuses;
    });
    setToolAccountPlanNames((currentPlanNames) => {
      const nextPlanNames = { ...currentPlanNames };
      const nextToolPlanNames = { ...(nextPlanNames[toolId] ?? {}) };
      delete nextToolPlanNames[accountLabel];
      nextPlanNames[toolId] = nextToolPlanNames;
      return nextPlanNames;
    });
    setToolAccountDetails((currentDetails) => {
      const nextDetails = { ...currentDetails };
      const nextToolDetails = { ...(nextDetails[toolId] ?? {}) };
      delete nextToolDetails[accountLabel];
      nextDetails[toolId] = nextToolDetails;
      return nextDetails;
    });
    if (shouldUseSupabase && targetTool) {
      try {
        await replaceToolLinks(toolId, nextAccounts, accountList);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not unlink account.";
        setToolDataError(message);
        setToolList(previousTools);
      }
    }
  };

  const archiveToolIds = async (toolIds: string[]) => {
    if (toolIds.length === 0) return;

    const selectedIds = new Set(toolIds);
    const archivedAt = new Date().toISOString();
    const previousTools = toolList;
    setToolList((currentTools) =>
      currentTools.map((tool) =>
        selectedIds.has(tool.id)
          ? { ...tool, archived: true, archivedAt, archivedStatus: tool.status }
          : tool,
      ),
    );
    setSelectedToolIds((currentIds) => currentIds.filter((currentId) => !selectedIds.has(currentId)));

    if (!shouldUseSupabase) return;

    try {
      await Promise.all(
        previousTools
          .filter((tool) => selectedIds.has(tool.id))
          .map((tool) =>
            patchToolRecord(tool.id, {
              archived: true,
              archivedAt,
              archivedStatus: tool.status,
            }),
          ),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not archive AI tool.";
      setToolDataError(message);
      setToolList(previousTools);
    }
  };

  const unarchiveToolIds = async (toolIds: string[]) => {
    if (toolIds.length === 0) return;

    const selectedIds = new Set(toolIds);
    const previousTools = toolList;
    setToolList((currentTools) =>
      currentTools.map((tool) =>
        selectedIds.has(tool.id)
          ? { ...tool, archived: false, status: tool.archivedStatus ?? tool.status, archivedAt: undefined, archivedStatus: undefined }
          : tool,
      ),
    );
    setSelectedToolIds((currentIds) => currentIds.filter((currentId) => !selectedIds.has(currentId)));

    if (!shouldUseSupabase) return;

    try {
      await Promise.all(
        previousTools
          .filter((tool) => selectedIds.has(tool.id))
          .map((tool) =>
            patchToolRecord(tool.id, {
              archived: false,
              archivedAt: undefined,
              archivedStatus: undefined,
              status: tool.archivedStatus ?? tool.status,
            }),
          ),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not restore AI tool.";
      setToolDataError(message);
      setToolList(previousTools);
    }
  };

  const deleteToolIds = async (toolIds: string[]) => {
    if (toolIds.length === 0) return;

    const selectedIds = new Set(toolIds);
    const toolsToDelete = toolList.filter((tool) => selectedIds.has(tool.id));
    const previousTools = toolList;
    createDeletedToolsArchive(toolsToDelete);
    setToolList((currentTools) => currentTools.filter((tool) => !selectedIds.has(tool.id)));
    setSelectedToolIds((currentIds) => currentIds.filter((currentId) => !selectedIds.has(currentId)));

    if (!shouldUseSupabase) return;

    try {
      await deleteToolRecords(toolIds);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not delete AI tool.";
      setToolDataError(message);
      setToolList(previousTools);
    }
  };

  const permanentlyDeleteToolIds = async (toolIds: string[]) => {
    if (toolIds.length === 0) return;

    const selectedIds = new Set(toolIds);
    const previousTools = toolList;
    setToolList((currentTools) => currentTools.filter((tool) => !selectedIds.has(tool.id)));
    setSelectedToolIds((currentIds) => currentIds.filter((currentId) => !selectedIds.has(currentId)));
    if (shouldUseSupabase) {
      try {
        await deleteToolRecords(toolIds);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not delete AI tool.";
        setToolDataError(message);
        setToolList(previousTools);
        return;
      }
    }
    showToast("Gone for good.");
  };

  const archiveEditingTool = async () => {
    if (!editingTool) return;

    await archiveToolIds([editingTool.id]);
    setEditingTool(null);
    setShowAddToolModal(false);
  };

  const deleteEditingTool = async () => {
    if (!editingTool) return;

    await deleteToolIds([editingTool.id]);
    setEditingTool(null);
    setShowAddToolModal(false);
  };

  const startEditingToolName = (tool: ToolItem) => {
    setEditingToolName(tool.name);
    setToolNameDraft(tool.name);
  };

  const saveInlineToolName = async () => {
    if (!editingToolName) return;

    const trimmedName = toolNameDraft.trim();
    if (!trimmedName) {
      setEditingToolName(null);
      setToolNameDraft("");
      return;
    }

    const targetTool = toolList.find((tool) => tool.name === editingToolName);
    const previousTools = toolList;
    const nextLogo = toolInitials(trimmedName);
    setToolList((currentTools) =>
      currentTools.map((tool) =>
        tool.name === editingToolName
          ? { ...tool, name: trimmedName, logo: nextLogo }
          : tool,
      ),
    );
    if (shouldUseSupabase && targetTool) {
      try {
        await patchToolRecord(targetTool.id, { logo: nextLogo, name: trimmedName });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not rename AI tool.";
        setToolDataError(message);
        setToolList(previousTools);
      }
    }
    setEditingToolName(null);
    setToolNameDraft("");
  };

  const cancelInlineToolName = () => {
    setEditingToolName(null);
    setToolNameDraft("");
  };

  const updateToolCategory = async (toolId: string, nextCategory: string) => {
    if (!nextCategory) return;

    if (nextCategory === customCategoryOption) {
      setEditingToolCategoryId(null);
      openEditCategoryModal();
      return;
    }

    const previousTools = toolList;
    setToolList((currentTools) =>
      currentTools.map((tool) =>
        tool.id === toolId ? { ...tool, category: nextCategory } : tool,
      ),
    );

    if (shouldUseSupabase) {
      try {
        await patchToolRecord(toolId, { category: nextCategory });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not update category.";
        setToolDataError(message);
        setToolList(previousTools);
        setEditingToolCategoryId(null);
        return;
      }
    }

    if (!workspaceCategories.includes(nextCategory)) {
      const nextCategories = [...workspaceCategories, nextCategory];
      setWorkspaceCategories(nextCategories);
      try {
        window.localStorage.setItem("ai-subprise-workspace-categories", JSON.stringify(nextCategories));
      } catch {
        // Local storage can be unavailable in private or embedded browser contexts.
      }
    }

    setEditingToolCategoryId(null);
  };

  const saveNewPassword = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    setProfileError("");
    setProfileMessage("");

    if (!isSupabaseConfigured) {
      setProfileError("Supabase is not configured yet.");
      return;
    }

    if (newPassword.trim().length < 6) {
      setProfileError("Password must be at least 6 characters.");
      return;
    }

    setIsSavingProfile(true);
    const supabase = createSupabaseClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setIsSavingProfile(false);

    if (error) {
      setProfileError(error.message);
      return;
    }

    setNewPassword("");
    setProfileMessage("Password updated.");
  };

  const signOut = async () => {
    if (!isSupabaseConfigured) {
      window.location.href = "/login";
      return;
    }

    const supabase = createSupabaseClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const handleInlineToolNameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      saveInlineToolName();
    }

    if (event.key === "Escape") {
      event.preventDefault();
      cancelInlineToolName();
    }
  };

  useEffect(() => {
    if (!draggedAccountLogin) return;

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      const hoveredRow = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>("[data-account-login]");
      const targetLogin = hoveredRow?.dataset.accountLogin;

      if (targetLogin && targetLogin !== draggedAccountLogin) {
        moveAccount(draggedAccountLogin, targetLogin);
      }
    };

    const handlePointerUp = () => setDraggedAccountLogin(null);

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [draggedAccountLogin]);

  useEffect(() => {
    if (!draggedToolName) return;

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      const hoveredRow = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>("[data-tool-name]");
      const targetName = hoveredRow?.dataset.toolName;

      if (targetName && targetName !== draggedToolName) {
        moveTool(draggedToolName, targetName);
      }
    };

    const handlePointerUp = () => setDraggedToolName(null);

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [draggedToolName]);

  useEffect(() => {
    if (draggedCategoryIndex === null) return;

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      const hoveredRow = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>("[data-category-index]");
      const targetIndex = Number(hoveredRow?.dataset.categoryIndex);

      if (Number.isInteger(targetIndex) && targetIndex !== draggedCategoryIndex) {
        moveCategoryDraft(draggedCategoryIndex, targetIndex);
      }
    };

    const handlePointerUp = () => setDraggedCategoryIndex(null);

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [draggedCategoryIndex]);

  const visibleTools = useMemo(() => {
    const selectedRange = toolSortOptions.find((option) => option.value === selectedToolSort) ?? toolSortOptions[0];
    const isInSelectedRange = (name: string) => {
      if (selectedToolSort === "All" || selectedToolSort === "Category") return true;

      const firstLetter = name.trim().charAt(0).toUpperCase();
      return firstLetter >= selectedRange.start && firstLetter <= selectedRange.end;
    };
    const filterBySection = () => {
      if (activeSection === "favorites") return toolsWithValidAccountLinks.filter((tool) => tool.favorite && !tool.archived);
      if (activeSection === "archive") return toolsWithValidAccountLinks.filter((tool) => tool.archived);
      if (activeSection === "linked") return toolsWithValidAccountLinks.filter((tool) => tool.accounts.length > 0 && !tool.archived);
      if (activeSection === "watchlist") return toolsWithValidAccountLinks.filter((tool) => tool.status === "Considering" && !tool.archived);
      if (activeSection === "tools" && activeCategory) {
        return toolsWithValidAccountLinks.filter((tool) => !tool.archived && tool.category === activeCategory);
      }
      return toolsWithValidAccountLinks.filter((tool) => !tool.archived);
    };

    const query = toolSearchQuery.trim().toLowerCase();
    const nextTools = filterBySection()
      .filter((tool) => isInSelectedRange(tool.name))
      .filter((tool) => {
        if (!query) return true;

        return [tool.name, tool.category, ...tool.accounts].some((value) =>
          value.toLowerCase().includes(query),
        );
      });

    if ((activeSection === "tools" && !hasCustomToolOrder) || activeSection === "favorites" || activeSection === "archive" || activeSection === "watchlist") {
      return [...nextTools].sort((firstTool, secondTool) => firstTool.name.localeCompare(secondTool.name));
    }

    return nextTools;
  }, [activeCategory, activeSection, hasCustomToolOrder, selectedToolSort, toolsWithValidAccountLinks, toolSearchQuery]);
  const totalToolboxCount = useMemo(
    () => toolsWithValidAccountLinks.filter((tool) => !tool.archived).length,
    [toolsWithValidAccountLinks],
  );
  const totalLinkedToolCount = useMemo(
    () => toolsWithValidAccountLinks.filter((tool) => tool.accounts.length > 0 && !tool.archived).length,
    [toolsWithValidAccountLinks],
  );
  const toolSearchTerm = toolSearchQuery.trim();
  const visibleToolIds = useMemo(() => visibleTools.map((tool) => tool.id), [visibleTools]);
  const selectedVisibleToolIds = useMemo(
    () => selectedToolIds.filter((toolId) => visibleToolIds.includes(toolId)),
    [selectedToolIds, visibleToolIds],
  );
  const areAllVisibleToolsSelected = visibleToolIds.length > 0 && selectedVisibleToolIds.length === visibleToolIds.length;
  const toggleVisibleToolSelection = () => {
    setSelectedToolIds((currentIds) => {
      const visibleIds = new Set(visibleToolIds);

      if (areAllVisibleToolsSelected) {
        return currentIds.filter((toolId) => !visibleIds.has(toolId));
      }

      return Array.from(new Set([...currentIds, ...visibleToolIds]));
    });
  };

  const sortedWorkspaceCategories = useMemo(
    () => sortCategoriesWithUncategorizedLast(workspaceCategories),
    [workspaceCategories],
  );
  const hasUncategorizedTools = useMemo(
    () => toolsWithValidAccountLinks.some((tool) => !tool.archived && tool.category === "Uncategorized"),
    [toolsWithValidAccountLinks],
  );
  const visibleWorkspaceCategories = useMemo(
    () => sortedWorkspaceCategories.filter((category) => category !== "Uncategorized" || hasUncategorizedTools),
    [hasUncategorizedTools, sortedWorkspaceCategories],
  );
  const groupedAccounts = useMemo(
    () => {
      const accountProviderNames = accountList.map((account) => account.provider);
      const groupedProviderNames = Array.from(new Set([...defaultProviders, ...customProviders, ...accountProviderNames]));

      return groupedProviderNames
        .map((providerName) => ({
          provider: providerName,
          accounts: accountList.filter((account) => account.provider === providerName),
        }))
        .filter((group) => group.accounts.length > 0);
    },
    [accountList, customProviders],
  );
  const orderedAccountOptions = useMemo(
    () =>
      groupedAccounts.flatMap((group) =>
        group.accounts.map((account) => ({
          description: account.login,
          label: account.label,
          tag: account.tag,
          value: account.label,
        })),
      ),
    [groupedAccounts],
  );
  const groupedToolCategories = useMemo(
    () => {
      const query = toolSearchQuery.trim();

      return visibleWorkspaceCategories
        .map((category) => ({
          category,
          tools: visibleTools.filter((tool) => tool.category === category),
        }))
        .filter((group) => {
          if (query) return group.tools.length > 0;

          return group.category !== "Uncategorized" || group.tools.length > 0;
        });
    },
    [toolSearchQuery, visibleWorkspaceCategories, visibleTools],
  );

  const providerOptions = useMemo(() => [...defaultProviders, ...customProviders], [customProviders]);
  const toolCategoryOptions = useMemo(
    () => {
      const categoryOptions = normaliseCategoryList([
          ...(sortedWorkspaceCategories.length > 0 ? sortedWorkspaceCategories : defaultToolCategories),
          ...customToolCategories,
          ...(toolCategory ? [toolCategory] : []),
        ]);

      if (editingTool?.category === "Uncategorized" || hasUncategorizedTools) {
        return categoryOptions;
      }

      return categoryOptions.filter((categoryOption) => categoryOption !== "Uncategorized");
    },
    [customToolCategories, editingTool?.category, hasUncategorizedTools, sortedWorkspaceCategories, toolCategory],
  );
  const loginFeedback = useMemo(() => validateLogin(provider, login), [login, provider]);
  const visibleLoginFeedback = hasSubmittedAccountForm ? loginFeedback : null;
  const accountLinkCounts = useMemo(() => {
    const counts = new Map<string, number>();

    toolsWithValidAccountLinks
      .filter((tool) => !tool.archived)
      .forEach((tool) => {
        Array.from(new Set(tool.accounts)).forEach((accountLabel) => {
          counts.set(accountLabel, (counts.get(accountLabel) ?? 0) + 1);
        });
      });

    return counts;
  }, [toolsWithValidAccountLinks]);
  const visibleSidebarAccounts = useMemo(
    () =>
      accountList
        .map((account, index) => ({
          ...account,
          linked: accountLinkCounts.get(account.label) ?? 0,
          sidebarOrder: index,
        }))
        .sort((a, b) => b.linked - a.linked || a.sidebarOrder - b.sidebarOrder)
        .slice(0, 2),
    [accountLinkCounts, accountList],
  );
  const accountViewUrl = isDemoMode ? "/dashboard?demo=1&view=account" : "/dashboard?view=account";
  const visibleRecoveryArchives = useMemo(() => {
    const query = recoverySearch.trim().toLowerCase();
    if (!query) return toolResetArchives;

    return toolResetArchives
      .map((archive) => ({
        ...archive,
        data: archive.data
          .map((group) => ({
            ...group,
            tools: group.tools.filter((tool) =>
              [tool.name, group.category, ...tool.accounts].some((value) => value.toLowerCase().includes(query)),
            ),
          }))
          .filter((group) => group.tools.length > 0),
      }))
      .filter((archive) => archive.data.length > 0);
  }, [recoverySearch, toolResetArchives]);
  const visibleRecoveryKeys = useMemo(
    () =>
      visibleRecoveryArchives.flatMap((archive) =>
        archive.data.flatMap((group) => group.tools.map((tool) => `${archive.id}:${tool.id}`)),
      ),
    [visibleRecoveryArchives],
  );
  const selectedVisibleRecoveryKeys = useMemo(
    () => selectedRecoveryKeys.filter((key) => visibleRecoveryKeys.includes(key)),
    [selectedRecoveryKeys, visibleRecoveryKeys],
  );
  const hasMoreSidebarAccounts = accountList.length > visibleSidebarAccounts.length;
  const defaultProviderRows = useMemo(() => defaultProviders.map((providerName) => ({ name: providerName })), []);
  const customProviderRows = useMemo(
    () => customProviders.map((customProvider) => ({ name: customProvider })),
    [customProviders],
  );
  const nicknameRequiredError = hasSubmittedAccountForm && !nickname.trim() ? "Nickname is required" : "";
  const nicknameDuplicateError =
    hasSubmittedAccountForm &&
    nickname.trim() &&
    accountList.some(
      (account) =>
        account.login !== editingAccount?.login &&
        account.label.trim().toLowerCase() === nickname.trim().toLowerCase(),
    )
      ? "This nickname already exists"
      : "";
  const providerRequiredError = hasSubmittedAccountForm && !provider.trim() ? "Provider is required" : "";
  const loginRequiredError = hasSubmittedAccountForm && !login.trim() ? "Login is required" : "";
  const loginDuplicateError =
    hasSubmittedAccountForm &&
    login.trim() &&
    accountList.some(
      (account) =>
        account.login !== editingAccount?.login &&
        account.login.trim().toLowerCase() === login.trim().toLowerCase(),
    )
      ? "This login already exists"
      : "";
  const toolNameRequiredError = hasSubmittedToolForm && !toolName.trim() ? "AI tool name is required" : "";
  const toolNameDuplicateError =
    hasSubmittedToolForm &&
    toolName.trim() &&
    toolList.some(
      (tool) =>
        tool.id !== editingTool?.id &&
        tool.name.trim().toLowerCase() === toolName.trim().toLowerCase(),
    )
      ? "This AI tool already exists"
      : "";
  const toolCategoryRequiredError = hasSubmittedToolForm && !toolCategory.trim() ? "Category is required" : "";
  const oldestRecoveryArchive = toolResetArchives.length > 0 ? toolResetArchives[toolResetArchives.length - 1] : undefined;
  const resetArchiveDaysRemaining = oldestRecoveryArchive
    ? Math.max(1, Math.ceil((resetArchiveMs - (Date.now() - new Date(oldestRecoveryArchive.createdAt).getTime())) / (24 * 60 * 60 * 1000)))
    : 0;
  const toolboxEmptyState =
    totalToolboxCount === 0
      ? {
          body: (
            <>
              <span>
                <button className="inline-text-link" onClick={openRoleQuestionModal} type="button">
                  Pick a template
                </button>{" "}
                that best describes you.
              </span>
              <span>AI Subprise will suggest the right categories to get you started.</span>
            </>
          ),
          title: "Your toolbox is empty",
        }
      : toolSearchTerm
        ? {
            body: <span>Try another search term.</span>,
            title: `No tools match '${toolSearchTerm}'`,
          }
        : selectedToolSort !== "All" && selectedToolSort !== "Category"
          ? {
              body: <span>Add a tool in this range when you are ready.</span>,
              title: `No tools starting with ${selectedToolSort} yet.`,
            }
          : activeCategory
            ? {
                body: <span>Add or move tools into this category when you are ready.</span>,
                title: `No tools in ${activeCategory} yet`,
              }
            : {
                body: <span>Add or move tools into this view when you are ready.</span>,
                title: "No tools yet",
              };
  const linkedEmptyState =
    totalLinkedToolCount === 0
      ? {
          body: (
            <span>
              Connect a tool to an account, or{" "}
              <button className="inline-text-link" onClick={() => openLinkToolModal()} type="button">
                Link AI Tool
              </button>{" "}
              to get started.
            </span>
          ),
          title: "Nothing linked yet",
        }
      : toolSearchTerm
        ? {
            body: null,
            title: `No linked tools match '${toolSearchTerm}'.`,
          }
        : selectedToolSort !== "All" && selectedToolSort !== "Category"
          ? {
              body: null,
              title: `No linked tools starting with ${selectedToolSort}.`,
            }
          : {
              body: null,
              title: "No linked tools here yet.",
            };

  const title =
    activeSection === "account"
      ? "My Account"
      : activeSection === "providers"
        ? "Edit Provider"
        : activeSection === "recovery"
          ? "Recently Deleted"
        : activeSection === "tools" && activeCategory
          ? activeCategory
        : navItems.find((item) => item.id === activeSection)?.label ?? "Dashboard";
  const sectionSubtitles: Partial<Record<Section, string>> = {
    dashboard: "Everything at a glance. Your tools, spend, and trials all in one place.",
    account: "All the accounts you sign up with. Add them once, use them everywhere.",
    tools: "Every tool you use, paid or free. Nothing forgotten.",
    linked: "See which account belongs to which tool. No more guessing.",
    billing: "Paid subscriptions by tool and account.",
    watchlist: "Tools you are considering. Keep them close before you link an account.",
    favorites: "The tools you reach for every day. Right here.",
    archive: "Tools on pause. Still here if you need them back.",
    settings: "Your preferences. Your way.",
  };
  const subtitle =
    activeSection === "providers"
        ? "Manage the provider names available in account entries"
        : activeSection === "recovery"
          ? "Restore tools from recent resets"
        : activeSection === "tools" && activeCategory
          ? `AI tools in ${activeCategory}`
      : sectionSubtitles[activeSection] ?? "Everything at a glance. Your tools, spend, and trials all in one place.";
  const availableToolSortOptions =
    activeSection === "watchlist"
      ? toolSortOptions.filter((option) => option.value === "Category" || option.value === "All")
      : toolSortOptions;
  const navBadgeCounts: Partial<Record<Section, number>> = {
    account: accountList.length,
    tools: toolsWithValidAccountLinks.filter((tool) => !tool.archived).length,
    linked: toolsWithValidAccountLinks.filter((tool) => tool.accounts.length > 0 && !tool.archived).length,
    billing: toolsWithValidAccountLinks.reduce(
      (count, tool) =>
        tool.archived
          ? count
          : count + tool.accounts.filter((accountLabel) => {
              const status = toolAccountStatuses[tool.id]?.[accountLabel] ?? tool.status;
              return status === "Active" || status === "Paid";
            }).length,
      0,
    ),
    watchlist: toolsWithValidAccountLinks.filter((tool) => tool.status === "Considering" && !tool.archived).length,
    favorites: toolsWithValidAccountLinks.filter((tool) => tool.favorite && !tool.archived).length,
    archive: toolsWithValidAccountLinks.filter((tool) => tool.archived).length,
    recovery: archiveToolCount(toolResetArchives),
  };
  const paidToolCount = toolsWithValidAccountLinks.filter((tool) =>
    !tool.archived && (tool.status === "Paid" || tool.status === "Active" || Object.values(toolAccountStatuses[tool.id] ?? {}).includes("Active")),
  ).length;
  const trialToolCount = toolsWithValidAccountLinks.filter((tool) =>
    !tool.archived && (tool.status === "Trial" || Object.values(toolAccountStatuses[tool.id] ?? {}).includes("Trial")),
  ).length;
  const trialsEndingSoon = remindersEnabled ? toolsWithValidAccountLinks
    .filter((tool) => !tool.archived)
    .flatMap((tool) =>
      tool.accounts.flatMap((accountLabel) => {
        const detail = toolAccountDetails[tool.id]?.[accountLabel];
        const relationPlan = relationStatus(tool, accountLabel);
        const daysRemaining = detail?.trialExpiryDate ? daysUntilDate(detail.trialExpiryDate) : null;

        if (relationPlan !== "Trial" || !detail?.trialExpiryDate || daysRemaining === null || daysRemaining < 0 || daysRemaining > Number(reminderDays)) {
          return [];
        }

        return [{
          accountLabel,
          daysRemaining,
          expiryDate: detail.trialExpiryDate,
          tool,
        }];
      }),
    )
    .sort((a, b) => a.daysRemaining - b.daysRemaining) : [];
  const renderToolNameCell = (tool: ToolItem) => (
    <div className="tool-name-cell">
      <div className="tool-logo" style={{ background: tool.logoBg }}>{toolInitials(tool.name)}</div>
      <div>
        {editingToolName === tool.name ? (
          <input
            aria-label={`Edit ${tool.name} name`}
            autoFocus
            className="tool-name-input"
            onBlur={saveInlineToolName}
            onChange={(event) => setToolNameDraft(event.target.value)}
            onKeyDown={handleInlineToolNameKeyDown}
            type="text"
            value={toolNameDraft}
          />
        ) : (
          <button
            className="tool-name editable-tool-name"
            onDoubleClick={() => startEditingToolName(tool)}
            type="button"
          >
            {displayToolName(tool.name)}
          </button>
        )}
      </div>
    </div>
  );

  const renderCategoryCell = (tool: ToolItem) => (
    renderDropdown({
      ariaLabel: `Change ${tool.name} category`,
      className: "category-pill-dropdown",
      id: `tool-category-${tool.id}`,
      onChange: (nextCategory) => updateToolCategory(tool.id, nextCategory),
      options: [
        ...sortCategoriesWithUncategorizedLast(Array.from(new Set([...toolCategoryOptions, tool.category]))).map((categoryOption) => ({
          label: categoryOption,
          value: categoryOption,
        })),
        { label: customCategoryOption, value: customCategoryOption },
      ],
      value: tool.category,
    })
  );

  const renderUrlIcon = (tool: ToolItem) => (
    <a
      aria-label={`${tool.name} pricing page`}
      className="pricing-link-icon"
      href={tool.pricingUrl}
      onClick={(event) => event.stopPropagation()}
      rel="noreferrer"
      target="_blank"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="8.25" />
        <path d="M3.75 12h16.5" />
        <path d="M12 3.75c2.05 2.2 3.15 5.05 3.15 8.25S14.05 18.05 12 20.25" />
        <path d="M12 3.75C9.95 5.95 8.85 8.8 8.85 12s1.1 6.05 3.15 8.25" />
      </svg>
    </a>
  );

  const relationPlan = (tool: ToolItem, accountLabel: string) => {
    const status = relationStatus(tool, accountLabel);
    if (status === "Trial") return "Trial";
    if (status === "Active" || status === "Paid") return "Paid";
    return "Free";
  };

  const relationPlanStatusValue = (tool: ToolItem, accountLabel: string): ToolStatus => {
    const plan = relationPlan(tool, accountLabel);
    if (plan === "Paid") return "Active";
    if (plan === "Trial") return "Trial";
    return "Free Tier";
  };

  const planStatusOptions: Array<{ label: string; value: ToolStatus }> = [
    { label: "Free", value: "Free Tier" },
    { label: "Trial", value: "Trial" },
    { label: "Paid", value: "Active" },
  ];
  const billingTypeOptions: DropdownOption[] = ["Monthly", "Annual", "One-time", "Top-up Credit"].map((billingType) => ({
    label: billingType,
    value: billingType,
  }));

  const linkedAccountPlanRank = (tool: ToolItem, accountLabel: string) => {
    const plan = relationPlan(tool, accountLabel);
    if (plan === "Paid") return 0;
    if (plan === "Trial") return 1;
    return 2;
  };

  const orderedLinkedAccountLabels = (tool: ToolItem) =>
    tool.accounts
      .map((accountLabel, index) => ({ accountLabel, index }))
      .sort(
        (firstAccount, secondAccount) =>
          linkedAccountPlanRank(tool, firstAccount.accountLabel) -
            linkedAccountPlanRank(tool, secondAccount.accountLabel) ||
          firstAccount.index - secondAccount.index,
      )
      .map((account) => account.accountLabel);

  const billingRows = toolsWithValidAccountLinks
    .filter((tool) => !tool.archived)
    .flatMap((tool) =>
      tool.accounts.flatMap((accountLabel) => {
        if (relationPlan(tool, accountLabel) !== "Paid") return [];

        const detail = toolAccountDetails[tool.id]?.[accountLabel];
        const billingAmounts = detail?.billingAmounts?.length
          ? detail.billingAmounts
          : normaliseBillingType(detail?.billingType ?? "Monthly").split(", ").filter(Boolean).map((billingType, index) => ({
              amount: index === 0 ? detail?.amount ?? "" : "",
              billingType,
              currency: normaliseCurrency(detail?.currency),
            }));
        return billingAmounts.map((billingAmount) => ({
            accountLabel,
            amount: billingAmount.amount,
            billingType: billingAmount.billingType,
            currency: normaliseCurrency(billingAmount.currency),
            nextChargeDate: detail?.nextChargeDate ?? "",
            planName: detail?.planName ?? toolAccountPlanNames[tool.id]?.[accountLabel] ?? "",
            tool,
          }));
      }),
    )
    .filter((row) => {
      const query = toolSearchQuery.trim().toLowerCase();
      if (!query) return true;

      return [
        row.tool.name,
        row.accountLabel,
        row.planName,
        row.billingType,
        row.currency,
        row.amount,
      ].some((value) => value.toLowerCase().includes(query));
    })
    .sort((firstRow, secondRow) =>
      (selectedBillingView === "Month"
        ? (firstRow.nextChargeDate || "9999-12-31").localeCompare(secondRow.nextChargeDate || "9999-12-31")
        : 0) ||
      firstRow.tool.name.localeCompare(secondRow.tool.name) ||
      firstRow.accountLabel.localeCompare(secondRow.accountLabel),
    );

  const renderLinkedAccountCell = (accountLabel: string) => {
    const accountDetails = accountList.find((account) => account.label === accountLabel);
    const tagClass = accountTag(accountLabel, accountList);

    return (
      <span className={`linked-account-cell ${tagClass}`}>
        <span className="linked-account-line">
          <span className={`tag-dot ${tagClass}`} />
          <strong>{accountLabel}</strong>
        </span>
        {accountDetails?.login ? <span className="linked-account-address">{accountDetails.login}</span> : null}
      </span>
    );
  };

  const renderBillingAccountCell = (accountLabel: string) => {
    const tagClass = accountTag(accountLabel, accountList);

    return (
      <span className={`billing-account-cell ${tagClass}`}>
        <span className={`tag-dot ${tagClass}`} />
        <strong>{accountLabel}</strong>
      </span>
    );
  };

  const renderBillingRow = (row: (typeof billingRows)[number], isContinuation = false) => (
    <article className={isContinuation ? "account-table-row tool-table-row billing-tool-row is-continuation" : "account-table-row tool-table-row billing-tool-row"} key={`${row.tool.id}-${row.accountLabel}-${row.billingType}`}>
      <div data-label="Tool Name">{isContinuation ? null : renderToolNameCell(row.tool)}</div>
      <div data-label="Account">{isContinuation ? null : renderBillingAccountCell(row.accountLabel)}</div>
      <span className="billing-plan-name" data-label="Plan Name">{row.planName || "Not set"}</span>
      <span data-label="Billing Type">
        {renderDropdown({
          ariaLabel: `${row.tool.name} ${row.accountLabel} billing type`,
          className: "billing-type-dropdown",
          id: `billing-type-${row.tool.id}-${row.accountLabel}-${row.billingType}`,
          onChange: (nextBillingType) =>
            updateBillingField(row.tool.id, row.accountLabel, { billingType: normaliseBillingType(nextBillingType) }),
          options: billingTypeOptions,
          selectedLabel: row.billingType === "Top-up Credit" ? "Top-up" : undefined,
          value: row.billingType,
        })}
      </span>
      <span data-label="Amount">
        <span className="billing-amount-field">
          {renderDropdown({
            ariaLabel: `${row.tool.name} ${row.accountLabel} currency`,
            className: "billing-currency-dropdown",
            id: `billing-currency-${row.tool.id}-${row.accountLabel}-${row.billingType}`,
            onChange: (nextCurrency) => {
              const currency = normaliseCurrency(nextCurrency);
              setToolAccountDetails((currentDetails) => {
                const detail = currentDetails[row.tool.id]?.[row.accountLabel];
                if (!detail) return currentDetails;
                return {
                  ...currentDetails,
                  [row.tool.id]: {
                    ...(currentDetails[row.tool.id] ?? {}),
                    [row.accountLabel]: {
                      ...detail,
                      billingAmounts: (detail.billingAmounts?.length ? detail.billingAmounts : [{
                        amount: detail.amount,
                        billingType: row.billingType,
                        currency: detail.currency,
                      }]).map((entry) =>
                        entry.billingType === row.billingType ? { ...entry, currency } : entry),
                    },
                  },
                };
              });
            },
            options: currencyOptions,
            value: row.currency,
          })}
          <input
            aria-label={`${row.tool.name} ${row.accountLabel} amount`}
            className="billing-inline-field"
            defaultValue={row.amount}
            inputMode="decimal"
            onBlur={(event) => {
              const nextValue = event.currentTarget.value.trim();
              if (nextValue !== row.amount) {
                setToolAccountDetails((currentDetails) => {
                  const detail = currentDetails[row.tool.id]?.[row.accountLabel];
                  if (!detail) return currentDetails;
                  return {
                    ...currentDetails,
                    [row.tool.id]: {
                      ...(currentDetails[row.tool.id] ?? {}),
                      [row.accountLabel]: {
                        ...detail,
                        billingAmounts: (detail.billingAmounts?.length ? detail.billingAmounts : [{
                          amount: detail.amount,
                          billingType: row.billingType,
                          currency: detail.currency,
                        }]).map((entry) =>
                          entry.billingType === row.billingType ? { ...entry, amount: nextValue } : entry),
                      },
                    },
                  };
                });
              }
            }}
            placeholder="0.00"
            step="0.01"
            type="number"
          />
        </span>
      </span>
      <span data-label="Next Charge">
        <label className="billing-date-picker">
          <span>{formatBillingDate(row.nextChargeDate)}</span>
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <rect x="4" y="5.5" width="16" height="14" rx="2" />
            <path d="M8 3.5v4M16 3.5v4M4 9.5h16" />
          </svg>
          <input
            aria-label={`${row.tool.name} ${row.accountLabel} next charge`}
            onChange={(event) => updateBillingField(row.tool.id, row.accountLabel, { nextChargeDate: event.target.value })}
            type="date"
            value={row.nextChargeDate}
          />
        </label>
      </span>
      <span className="row-actions" data-label="Action">
        <button
          aria-label={`Edit billing for ${row.tool.name} ${row.accountLabel}`}
          className="row-icon-action tooltip-target"
          data-tooltip="Edit billing"
          onClick={() => openBillingEditModal(row.tool.id, row.accountLabel)}
          type="button"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M5 19h4l9.2-9.2a2.1 2.1 0 0 0-3-3L6 16v3Z" />
            <path d="m13.8 7.2 3 3" />
          </svg>
        </button>
      </span>
    </article>
  );

  const renderLinkedAccounts = (tool: ToolItem, options?: { removable?: boolean }) => (
    <div className={options?.removable ? "linked-accordion-panel" : "tool-accordion-panel"}>
      {orderedLinkedAccountLabels(tool).map((accountLabel) => {
        const plan = relationPlan(tool, accountLabel);

        if (options?.removable) {
          return (
            <div className="tool-account-subrow linked-account-identity-row" key={`${tool.id}-${accountLabel}`}>
              <span />
              <span />
              <span />
              {renderLinkedAccountCell(accountLabel)}
              <span className="linked-expanded-plan-cell" data-label="Plan">
                {renderDropdown({
                  ariaLabel: `Change ${accountLabel} plan`,
                  className: `plan-pill-dropdown plan-pill-${plan.toLowerCase()}`,
                  id: `relation-plan-${tool.id}-${accountLabel}`,
                  onChange: (nextStatus) => updateRelationStatus(tool.id, accountLabel, nextStatus as ToolStatus),
                  options: planStatusOptions,
                  value: relationPlanStatusValue(tool, accountLabel),
                })}
              </span>
              <span className="linked-row-actions">
                <button
                  aria-label={`Link another account to ${tool.name}`}
                  className="row-icon-action tooltip-target"
                  data-tooltip="Link another account"
                  onClick={() => openLinkToolModal(tool)}
                  type="button"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24">
                    <path d="M9.5 14.5 14.5 9.5" />
                    <path d="M10.5 7.5 12 6a4 4 0 0 1 5.7 5.7l-1.5 1.5" />
                    <path d="M13.5 16.5 12 18a4 4 0 0 1-5.7-5.7l1.5-1.5" />
                  </svg>
                </button>
                <button
                  aria-label={`Edit ${accountLabel}`}
                  className="row-icon-action linked-manage-link tooltip-target"
                  data-tooltip="Edit"
                  onClick={() => openManageAccountModal(tool, accountLabel)}
                  type="button"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24">
                    <path d="M5 19h4l9.2-9.2a2.1 2.1 0 0 0-3-3L6 16v3Z" />
                    <path d="m13.8 7.2 3 3" />
                  </svg>
                </button>
              </span>
            </div>
          );
        }

        return (
          <div className="tool-account-subrow" key={`${tool.id}-${accountLabel}`}>
            <span className="account-subrow-name">
              <span className={`tag-dot ${accountTag(accountLabel, accountList)}`} />
              <span>{accountLabel}</span>
            </span>
            {renderDropdown({
              ariaLabel: `Change ${accountLabel} status`,
              className: `status-dropdown ${statusTone(relationStatus(tool, accountLabel))}`,
              id: `relation-status-${tool.id}-${accountLabel}`,
              onChange: (nextStatus) => updateRelationStatus(tool.id, accountLabel, nextStatus as ToolStatus),
              options: (["Active", "Trial", "Free Tier", "Paused", "Considering", "Cancelled"] as ToolStatus[]).map((statusOption) => ({
                label: statusDisplayLabel(statusOption),
                value: statusOption,
              })),
              value: relationStatus(tool, accountLabel),
            })}
            <span />
          </div>
        );
      })}
    </div>
  );

  const renderFavouriteLinkedAccounts = (tool: ToolItem) => (
    <div className="linked-accordion-panel favourite-accordion-panel">
      {tool.accounts.map((accountLabel) => (
        <div className="tool-account-subrow favourite-account-row" key={`${tool.id}-${accountLabel}`}>
          <span />
          <span />
          <span />
          <span />
          {renderLinkedAccountCell(accountLabel)}
          <span />
          <span />
        </div>
      ))}
    </div>
  );

  const renderToolRow = (tool: ToolItem) => {
    const isExpanded = expandedToolIds.includes(tool.id);
    const primaryAccount = tool.accounts[0] ?? "";
    const hasManyAccounts = tool.accounts.length > 1;

    if (activeSection === "linked") {
      const accountLabel = tool.accounts[0] ?? "";
      const plan = accountLabel ? relationPlan(tool, accountLabel) : "Free";
      return (
        <Fragment key={tool.id}>
          <article
            className={hasManyAccounts ? "account-table-row tool-table-row linked-tool-row" : "account-table-row tool-table-row linked-tool-row is-single-account"}
            onClick={() => {
              if (hasManyAccounts) toggleToolExpanded(tool.id);
            }}
          >
            <span className="tool-select-cell linked-select-cell" onClick={(event) => event.stopPropagation()}>
              <input
                aria-label={`Select ${tool.name}`}
                checked={selectedToolIds.includes(tool.id)}
                className="tool-row-checkbox"
                onChange={() => toggleToolSelection(tool.id)}
                type="checkbox"
              />
            </span>
            <button
              aria-label={tool.favorite ? `Remove ${tool.name} from favourites` : `Add ${tool.name} to favourites`}
              aria-pressed={tool.favorite}
              className={tool.favorite ? "notion-star-checkbox is-checked" : "notion-star-checkbox"}
              onClick={(event) => {
                event.stopPropagation();
                toggleToolFavorite(tool.name);
              }}
              type="button"
            >
              <span className="notion-checkbox-box">
                {tool.favorite ? (
                  <svg aria-hidden="true" viewBox="0 0 24 24">
                    <FavoriteStarIconPaths />
                  </svg>
                ) : null}
              </span>
            </button>
            <div className="linked-tool-name-cell" data-label="Tool Name">
              {renderToolNameCell(tool)}
            </div>
            <div className={hasManyAccounts ? "linked-account-summary-cell" : undefined} data-label="Account">
              {hasManyAccounts ? (
                <>
                  <span className="linked-account-count-pill">{tool.accounts.length} accounts</span>
                  <button
                    aria-label={isExpanded ? `Collapse ${tool.name}` : `Expand ${tool.name}`}
                    aria-expanded={isExpanded}
                    className={
                      isExpanded
                        ? "row-toggle-control linked-row-toggle tooltip-target is-open"
                        : "row-toggle-control linked-row-toggle tooltip-target"
                    }
                    data-tooltip={isExpanded ? "Collapse accounts" : "Expand accounts"}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleToolExpanded(tool.id);
                    }}
                    type="button"
                  >
                    <span />
                  </button>
                </>
              ) : accountLabel ? (
                renderLinkedAccountCell(accountLabel)
              ) : null}
            </div>
            <span data-label="Plan">
              {!hasManyAccounts && accountLabel ? renderDropdown({
                ariaLabel: `Change ${accountLabel} plan`,
                className: `plan-pill-dropdown plan-pill-${plan.toLowerCase()}`,
                id: `relation-plan-${tool.id}-${accountLabel}`,
                onChange: (nextStatus) => updateRelationStatus(tool.id, accountLabel, nextStatus as ToolStatus),
                options: planStatusOptions,
                value: relationPlanStatusValue(tool, accountLabel),
              }) : null}
            </span>
            <span className="linked-tool-action-cell" data-label="Action">
              {hasManyAccounts ? (
                null
              ) : accountLabel ? (
                <span className="linked-row-actions">
                  <button
                    aria-label={`Link another account to ${tool.name}`}
                    className="row-icon-action tooltip-target"
                    data-tooltip="Link another account"
                    onClick={(event) => {
                      event.stopPropagation();
                      openLinkToolModal(tool);
                    }}
                    type="button"
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24">
                      <path d="M9.5 14.5 14.5 9.5" />
                      <path d="M10.5 7.5 12 6a4 4 0 0 1 5.7 5.7l-1.5 1.5" />
                      <path d="M13.5 16.5 12 18a4 4 0 0 1-5.7-5.7l1.5-1.5" />
                    </svg>
                  </button>
                  <button
                    aria-label={`Edit ${accountLabel}`}
                    className="row-icon-action linked-manage-link tooltip-target"
                    data-tooltip="Edit"
                    onClick={(event) => {
                      event.stopPropagation();
                      openManageAccountModal(tool, accountLabel);
                    }}
                    type="button"
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24">
                      <path d="M5 19h4l9.2-9.2a2.1 2.1 0 0 0-3-3L6 16v3Z" />
                      <path d="m13.8 7.2 3 3" />
                    </svg>
                  </button>
                </span>
              ) : null}
            </span>
          </article>
          {isExpanded ? renderLinkedAccounts(tool, { removable: true }) : null}
        </Fragment>
      );
    }

    if (activeSection === "favorites") {
      return (
        <Fragment key={tool.id}>
          <article
            className="account-table-row tool-table-row favourite-tool-row"
            onClick={() => {
              if (hasManyAccounts) toggleToolExpanded(tool.id);
            }}
          >
            <span />
            <button
              aria-label={`Remove ${tool.name} from favourites`}
              aria-pressed="true"
              className="notion-star-checkbox is-checked"
              onClick={(event) => {
                event.stopPropagation();
                setConfirmToolStateChange({ action: "unfavorite", tool });
              }}
              type="button"
            >
              <span className="notion-checkbox-box">
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <FavoriteStarIconPaths />
                </svg>
              </span>
            </button>
            <div data-label="Tool Name">{renderToolNameCell(tool)}</div>
            <div className="category-cell" data-label="Category">{renderCategoryCell(tool)}</div>
            <div className={hasManyAccounts ? "account-used-cell linked-account-summary-cell" : "account-used-cell"} data-label="Account Used">
              {primaryAccount ? (
                hasManyAccounts ? (
                  <>
                    <span className="linked-account-count-pill">{tool.accounts.length} accounts</span>
                    <button
                      aria-label={isExpanded ? `Collapse ${tool.name}` : `Expand ${tool.name}`}
                      aria-expanded={isExpanded}
                      className={
                        isExpanded
                          ? "row-toggle-control linked-row-toggle tooltip-target is-open"
                          : "row-toggle-control linked-row-toggle tooltip-target"
                      }
                      data-tooltip={isExpanded ? "Collapse accounts" : "Expand accounts"}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleToolExpanded(tool.id);
                      }}
                      type="button"
                    >
                      <span />
                    </button>
                  </>
                ) : (
                  <span className={`email-tag ${accountTag(primaryAccount, accountList)}`}>
                    <span className="tag-dot" />
                    {primaryAccount}
                  </span>
                )
              ) : (
                <span className="muted-cell">No account linked</span>
              )}
            </div>
            <span data-label="URL">{renderUrlIcon(tool)}</span>
            <span className="row-actions" data-label="Action">
              <button
                aria-label={tool.accounts.length > 0 ? `${tool.name} already has linked accounts` : `Link account to ${tool.name}`}
                className={
                  tool.accounts.length > 0
                    ? "row-icon-action link-state-action is-linked tooltip-target"
                    : "row-icon-action link-state-action tooltip-target"
                }
                data-tooltip={tool.accounts.length > 0 ? "Already linked" : "Link account"}
                disabled={tool.accounts.length > 0}
                onClick={(event) => {
                  event.stopPropagation();
                  if (tool.accounts.length > 0) {
                    return;
                  }

                  openLinkToolModal(tool);
                }}
                type="button"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <path d="M9.5 14.5 14.5 9.5" />
                  <path d="M10.5 7.5 12 6a4 4 0 0 1 5.7 5.7l-1.5 1.5" />
                  <path d="M13.5 16.5 12 18a4 4 0 0 1-5.7-5.7l1.5-1.5" />
                  {tool.accounts.length === 0 ? <path d="m4.5 4.5 15 15" /> : null}
                </svg>
              </button>
              <button aria-label={`Edit ${tool.name}`} className="row-icon-action" onClick={() => openEditToolModal(tool)} type="button">
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <path d="M5 19h4l9.2-9.2a2.1 2.1 0 0 0-3-3L6 16v3Z" />
                  <path d="m13.8 7.2 3 3" />
                </svg>
              </button>
            </span>
          </article>
          {isExpanded && hasManyAccounts ? renderFavouriteLinkedAccounts(tool) : null}
        </Fragment>
      );
    }

    if (activeSection === "archive") {
      return (
        <article className="account-table-row tool-table-row archived-tool-row" key={tool.id}>
          <span className="tool-select-cell" data-label="Select">
            <input
              aria-label={`Select ${tool.name}`}
              checked={selectedToolIds.includes(tool.id)}
              className="tool-row-checkbox"
              onChange={() => toggleToolSelection(tool.id)}
              type="checkbox"
            />
          </span>
          <div data-label="Tool Name">{renderToolNameCell(tool)}</div>
          <div className="category-cell" data-label="Category">{renderCategoryCell(tool)}</div>
          <div className="status-cell" data-label="Last Status">
            <span className={`tool-status-chip ${archivedStatusTone(tool.archivedStatus ?? tool.status)}`}>
              {archivedStatusLabel(tool.archivedStatus ?? tool.status)}
            </span>
          </div>
          <span className="muted-cell small-date" data-label="Archived On">{formatArchiveDate(tool.archivedAt)}</span>
          <span className="row-actions" data-label="Action">
            <button className="text-action-link" onClick={() => setConfirmToolStateChange({ action: "unarchive", tool })} type="button">
              Restore
            </button>
            <button
              aria-label={`Delete ${tool.name}`}
              className="row-icon-action danger"
              onClick={() => permanentlyDeleteToolIds([tool.id])}
              type="button"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <TrashIconPaths />
              </svg>
            </button>
          </span>
        </article>
      );
    }

    return (
      <article className="account-table-row tool-table-row toolbox-tool-row" key={tool.id}>
        <span className="tool-select-cell" data-label="Select">
          <input
            aria-label={`Select ${tool.name}`}
            checked={selectedToolIds.includes(tool.id)}
            className="tool-row-checkbox"
            onChange={() => toggleToolSelection(tool.id)}
            type="checkbox"
          />
        </span>
        <button
          aria-label={tool.favorite ? `Remove ${tool.name} from favourites` : `Add ${tool.name} to favourites`}
          aria-pressed={tool.favorite}
          className={tool.favorite ? "notion-star-checkbox is-checked" : "notion-star-checkbox"}
          onClick={() => toggleToolFavorite(tool.name)}
          type="button"
        >
          <span className="notion-checkbox-box">
            {tool.favorite ? (
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <FavoriteStarIconPaths />
              </svg>
            ) : null}
          </span>
        </button>
        <div data-label="Tool Name">{renderToolNameCell(tool)}</div>
        <div className="category-cell" data-label="Category">{renderCategoryCell(tool)}</div>
        <span data-label="URL">{renderUrlIcon(tool)}</span>
        <span className="watchlist-cell" data-label="Watchlist">
          <button
            aria-label={tool.status === "Considering" ? `Remove ${tool.name} from Watchlist` : `Add ${tool.name} to Watchlist`}
            aria-pressed={tool.status === "Considering"}
            className={tool.status === "Considering" ? "row-icon-action watchlist-action is-active tooltip-target" : "row-icon-action watchlist-action tooltip-target"}
            data-tooltip={tool.status === "Considering" ? "Remove from Watchlist" : "Add to Watchlist"}
            onClick={() => toggleToolWatchlist(tool.id)}
            type="button"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              {tool.status === "Considering" ? (
                <>
                  <path d="M4 12s2.8-5 8-5 8 5 8 5-2.8 5-8 5-8-5-8-5Z" />
                  <circle cx="12" cy="12" r="2.45" />
                </>
              ) : (
                <>
                  <path d="M4 12s2.8-5 8-5 8 5 8 5-2.8 5-8 5-8-5-8-5Z" />
                  <circle cx="12" cy="12" r="2.2" />
                  <path d="m4.5 4.5 15 15" />
                </>
              )}
            </svg>
          </button>
        </span>
        <span className="row-actions" data-label="Action">
          <button
            aria-label={tool.accounts.length > 0 ? `${tool.name} already has linked accounts` : `Link account to ${tool.name}`}
            className={
              tool.accounts.length > 0
                ? "row-icon-action link-state-action is-linked tooltip-target"
                : "row-icon-action link-state-action tooltip-target"
            }
            data-tooltip={tool.accounts.length > 0 ? "Already linked" : "Link account"}
            disabled={tool.accounts.length > 0}
            onClick={() => {
              if (tool.accounts.length > 0) {
                return;
              }

              activeSection === "watchlist"
                ? openLinkToolModal(tool, { activateToolOnSave: true })
                : openLinkToolModal(tool);
            }}
            type="button"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M9.5 14.5 14.5 9.5" />
              <path d="M10.5 7.5 12 6a4 4 0 0 1 5.7 5.7l-1.5 1.5" />
              <path d="M13.5 16.5 12 18a4 4 0 0 1-5.7-5.7l1.5-1.5" />
              {tool.accounts.length === 0 ? <path d="m4.5 4.5 15 15" /> : null}
            </svg>
          </button>
          <button aria-label={`Edit ${tool.name}`} className="row-icon-action" onClick={() => openEditToolModal(tool)} type="button">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M5 19h4l9.2-9.2a2.1 2.1 0 0 0-3-3L6 16v3Z" />
              <path d="m13.8 7.2 3 3" />
            </svg>
          </button>
        </span>
      </article>
    );
  };

  const managedTool = managingLink ? toolList.find((tool) => tool.id === managingLink.toolId) : null;
  const managedAccount = accountList.find((account) => account.label === managedAccountLabel);
  const managedAccountOptions = managingLink
    ? orderedAccountOptions.map((accountOption) => ({
        ...accountOption,
        disabled: accountOption.value !== managingLink.accountLabel && Boolean(managedTool?.accounts.includes(accountOption.value)),
      }))
    : [];
  const isDuplicateManagedAccount =
    Boolean(managingLink && managedTool && managedAccountLabel !== managingLink.accountLabel && managedTool.accounts.includes(managedAccountLabel));
  const activeToolOptions = toolList.filter((tool) => !tool.archived);
  const linkToolSearchOptions = isLinkToolLocked
    ? activeToolOptions
    : activeToolOptions.filter((tool) => tool.accounts.length === 0);
  const filteredLinkToolOptions = linkToolSearchOptions.filter((tool) =>
    tool.name.toLowerCase().includes(linkToolSearchQuery.trim().toLowerCase()),
  );
  const selectedLinkTool = toolList.find((tool) => tool.id === linkToolId);
  const selectedLinkToolAllowedPlans = selectedLinkTool ? toolCustomizationFor(selectedLinkTool.name)?.allowedPlans : undefined;
  const selectedLinkAccountLabels = linkToolAccountBlocks.map((block) => block.accountLabel).filter(Boolean);
  const existingLinkAccountLabels = selectedLinkTool?.accounts ?? [];
  const remainingLinkAccountOptions = orderedAccountOptions.filter(
    (accountOption) =>
      !existingLinkAccountLabels.includes(accountOption.value) &&
      !selectedLinkAccountLabels.includes(accountOption.value),
  );
  const duplicateLinkAccountLabels = selectedLinkAccountLabels.filter(
    (accountLabel, index) => selectedLinkAccountLabels.indexOf(accountLabel) !== index,
  );
  const isLinkToolSubmitBlocked =
    !linkToolId ||
    linkToolAccountBlocks.some((block) => !block.accountLabel || !block.plan) ||
    linkToolAccountBlocks.some((block) => !isPlanAllowedForTool(selectedLinkTool, block.plan)) ||
    linkToolAccountBlocks.some((block) => Boolean(block.accountLabel && selectedLinkTool?.accounts.includes(block.accountLabel))) ||
    duplicateLinkAccountLabels.length > 0;

  useEffect(() => {
    if (!selectedLinkToolAllowedPlans?.length) return;

    const firstAllowedStatus = statusForPlanKey(selectedLinkToolAllowedPlans[0]);
    setLinkToolAccountBlocks((currentBlocks) => {
      const nextBlocks = currentBlocks.map((block) =>
        selectedLinkToolAllowedPlans.includes(planKeyForStatus(block.plan))
          ? block
          : { ...block, plan: firstAllowedStatus },
      );

      return nextBlocks.some((block, index) => block.plan !== currentBlocks[index].plan) ? nextBlocks : currentBlocks;
    });
  }, [selectedLinkToolAllowedPlans]);

  return (
    <main className="app-shell" data-theme="dark" data-dark-variant="cool">
      <button
        aria-expanded={isSidebarOpen}
        aria-label="Open dashboard navigation"
        className="mobile-menu-button"
        onClick={() => setIsSidebarOpen((isOpen) => !isOpen)}
        type="button"
      >
        <span />
        <span />
        <span />
      </button>

      <button
        aria-label="Close dashboard navigation"
        className={isSidebarOpen ? "sidebar-scrim is-visible" : "sidebar-scrim"}
        onClick={() => setIsSidebarOpen(false)}
        type="button"
      />

      <div className={isSidebarCollapsed ? "dashboard-frame sidebar-is-collapsed" : "dashboard-frame"}>
        <aside
          className={[
            "sidebar",
            isSidebarOpen ? "is-open" : "",
            isSidebarCollapsed ? "is-collapsed" : "",
          ].filter(Boolean).join(" ")}
          aria-label="Dashboard navigation"
          style={isSidebarOpen ? { transform: "translateX(0)" } : undefined}
        >
          <div className="sidebar-header">
            <Link className="sidebar-logo" href="/">
              <div className="sidebar-logo-icon">AI</div>
              <div className="sidebar-logo-name">
                AI Sub<span>prise</span>
              </div>
            </Link>
            <button
              aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-pressed={isSidebarCollapsed}
              className="sidebar-collapse-handle tooltip-target"
              data-tooltip={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={() => setIsSidebarCollapsed((isCollapsed) => !isCollapsed)}
              type="button"
            >
              <span />
            </button>
          </div>

          <nav className="sidebar-nav" aria-label="Workspace">
            <div className="nav-label">Workspace</div>
            {navItems.slice(0, 8).map((item) => (
              item.id === "tools" ? (
                <div className="nav-tree" key={item.id}>
                  <button
                    aria-current={!showRecoveryPanel && activeSection === "tools" && !activeCategory ? "page" : undefined}
                    aria-expanded={isToolsNavOpen}
                    className={!showRecoveryPanel && activeSection === "tools" && !activeCategory ? "nav-item active nav-parent" : "nav-item nav-parent"}
                    onClick={() => {
                      const isReturningFromToolCategory = activeSection === "tools" && Boolean(activeCategory);
                      setActiveSection("tools");
                      setActiveCategory("");
                      setShowRecoveryPanel(false);
                      if (isReturningFromToolCategory) {
                        setIsToolsNavOpen(true);
                        try {
                          window.localStorage.setItem("ai-subprise-tools-nav-open", "true");
                        } catch {
                          // Local storage can be unavailable in private or embedded browser contexts.
                        }
                        return;
                      }

                      toggleToolsNav();
                    }}
                    type="button"
                  >
                    <SidebarIcon name={item.icon} />
                    {item.label}
                    <span
                      aria-hidden="true"
                      className="nav-tree-tooltip-wrap tooltip-target"
                      data-tooltip={isToolsNavOpen ? "Collapse categories" : "Expand categories"}
                    >
                      <span className="nav-tree-handle" />
                    </span>
                  </button>
                  {isToolsNavOpen ? (
                    <div className="nav-subitems">
                      {hasConfirmedCategories ? (
                        visibleWorkspaceCategories.map((category) => (
                          <button
                            aria-current={!showRecoveryPanel && activeSection === "tools" && activeCategory === category ? "page" : undefined}
                            className={
                              !showRecoveryPanel && activeSection === "tools" && activeCategory === category
                                ? "nav-subitem active"
                                : "nav-subitem"
                            }
                            key={category}
                            onClick={() => {
                              setActiveSection("tools");
                              setActiveCategory(category);
                              setSelectedToolSort("All");
                              setShowRecoveryPanel(false);
                              setIsSidebarOpen(false);
                            }}
                            type="button"
                          >
                            {category}
                          </button>
                        ))
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : (
                <button
                  aria-current={!showRecoveryPanel && activeSection === item.id ? "page" : undefined}
                  className={!showRecoveryPanel && activeSection === item.id ? "nav-item active" : "nav-item"}
                  key={item.id}
                  onClick={() => {
                    setActiveSection(item.id);
                    setActiveCategory("");
                    setShowRecoveryPanel(false);
                    setIsSidebarOpen(false);
                  }}
                  type="button"
                >
                  <SidebarIcon name={item.icon} />
                  {item.label}
                  {(navBadgeCounts[item.id] ?? 0) > 0 ? (
                    <span className="badge">{navBadgeCounts[item.id]}</span>
                  ) : null}
                </button>
              )
            ))}
          </nav>

          <nav className="sidebar-utility" aria-label="Utilities">
            {navItems.slice(8).map((item) => (
              <button
                aria-current={item.id === "recovery" ? undefined : activeSection === item.id ? "page" : undefined}
                className={
                  item.id === "recovery"
                    ? showRecoveryPanel
                      ? "nav-item active"
                      : "nav-item"
                    : activeSection === item.id
                      ? "nav-item active"
                      : "nav-item"
                }
                key={item.id}
                onClick={() => {
                  if (item.id === "recovery") {
                    setShowRecoveryPanel((isVisible) => !isVisible);
                    setIsSidebarOpen(false);
                    return;
                  }

                  setActiveSection(item.id);
                  setActiveCategory("");
                  setShowRecoveryPanel(false);
                  setIsSidebarOpen(false);
                }}
                type="button"
              >
                <SidebarIcon name={item.icon} />
                {item.label}
                {item.id !== "recovery" && (navBadgeCounts[item.id] ?? 0) > 0 ? (
                  <span className="badge">{navBadgeCounts[item.id]}</span>
                ) : null}
              </button>
            ))}
          </nav>

          <div className="sidebar-emails">
            <div className="nav-label">Top Accounts</div>
            {visibleSidebarAccounts.map((account) => (
              <button
                className="email-account-item"
                key={account.login}
                onClick={() => {
                  window.history.pushState(null, "", accountViewUrl);
                  setActiveSection("account");
                  setShowRecoveryPanel(false);
                  setIsSidebarOpen(false);
                }}
                type="button"
              >
                <span className="email-account-info">
                  <span className={`email-tag sidebar-email-tag ${account.tag}`}>
                    <span className="tag-dot" />
                    {account.label}
                  </span>
                  <span className="email-account-address">{account.login}</span>
                </span>
                <span className="email-tool-count">{account.linked}</span>
              </button>
            ))}
            {hasMoreSidebarAccounts ? (
              <button
                className="email-account-item email-view-all"
                onClick={() => {
                  window.history.pushState(null, "", accountViewUrl);
                  setActiveSection("account");
                  setShowRecoveryPanel(false);
                  setIsSidebarOpen(false);
                }}
                type="button"
              >
                View all
              </button>
            ) : null}
          </div>

        </aside>

        {showRecoveryPanel ? (
          <div className="recovery-dismiss-layer" onClick={() => setShowRecoveryPanel(false)} role="presentation">
            <section
              aria-label="Recently Deleted"
              className="recovery-panel"
              onClick={(event) => event.stopPropagation()}
            >
              <label className="recovery-search">
                <input
                  onChange={(event) => setRecoverySearch(event.target.value)}
                  placeholder="search in Recently Deleted"
                  type="search"
                  value={recoverySearch}
                />
              </label>
              <div className="recovery-list">
                {visibleRecoveryArchives.length > 0 ? (
                  visibleRecoveryArchives.map((archive) => {
                    const isExpanded = expandedRecoveryIds.includes(archive.id);
                    const archiveToolsCount = archiveTools(archive).length;

                    return (
                      <section className="recovery-group" key={archive.id}>
                        <button
                          aria-expanded={isExpanded}
                          className="recovery-group-header"
                          onClick={() => toggleRecoveryGroup(archive.id)}
                          type="button"
                        >
                          <span>
                            <strong>
                              {new Date(archive.createdAt).toLocaleString("en-GB", {
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </strong>
                            <small>{archiveToolsCount} {archiveToolsCount === 1 ? "tool" : "tools"}</small>
                          </span>
                          <span className="recovery-group-handle" aria-hidden="true" />
                        </button>
                        {isExpanded ? (
                          <>
                            {archive.data.map((group) => (
                              <div className="recovery-category-group" key={`${archive.id}-${group.category}`}>
                                {group.tools.map((tool) => {
                                  const recoveryKey = `${archive.id}:${tool.id}`;
                                  return (
                                    <article className="recovery-item" key={recoveryKey}>
                                      <input
                                        aria-label={`Select ${tool.name}`}
                                        checked={selectedRecoveryKeys.includes(recoveryKey)}
                                        onChange={() => toggleRecoveryTool(archive.id, tool.id)}
                                        type="checkbox"
                                      />
                                      <span className="recovery-item-copy">
                                        <strong>{tool.name}</strong>
                                      </span>
                                      <span className="recovery-item-category">{group.category}</span>
                                      <span className="recovery-item-actions">
                                        <button
                                          aria-label={`Restore ${tool.name}`}
                                          className="recovery-icon-button"
                                          onClick={() => restoreSingleArchivedTool(archive.id, tool.id)}
                                          type="button"
                                        >
                                          <svg aria-hidden="true" viewBox="0 0 24 24">
                                            <path d="M9 10H5V6" />
                                            <path d="M5 10a7 7 0 1 0 2-5" />
                                          </svg>
                                        </button>
                                        <button
                                          aria-label={`Delete ${tool.name} permanently`}
                                          className="recovery-icon-button"
                                          onClick={() => deleteSingleArchivedTool(archive.id, tool.id)}
                                          type="button"
                                        >
                                          <svg aria-hidden="true" viewBox="0 0 24 24">
                                            <TrashIconPaths />
                                          </svg>
                                        </button>
                                      </span>
                                    </article>
                                  );
                                })}
                              </div>
                            ))}
                          </>
                        ) : null}
                      </section>
                    );
                  })
                ) : (
                  <div className="recovery-empty">No recovered tools here yet</div>
                )}
              </div>
              <div className="recovery-footer">
                <span className="recovery-note">
                  Once it has been in Recently Deleted for 30 days, it will be automatically deleted.
                </span>
                <button
                  className={
                    selectedVisibleRecoveryKeys.length > 1
                      ? "recovery-restore-selected is-bulk-ready"
                      : "recovery-restore-selected"
                  }
                  disabled={selectedVisibleRecoveryKeys.length === 0}
                  onClick={() => restoreSelectedRecoveryTools(undefined, selectedVisibleRecoveryKeys)}
                  type="button"
                >
                  Restore selected ({selectedVisibleRecoveryKeys.length})
                </button>
              </div>
            </section>
          </div>
        ) : null}

        <section className="main-content">
          <header className="main-header">
            <div>
              <h1 className={activeSection === "providers" ? "main-title main-title-with-back" : "main-title"}>
                {activeSection === "providers" ? (
                  <button
                    aria-label="Back to My Account"
                    className="title-back-button tooltip-target"
                    data-tooltip="Back to My Account"
                    onClick={() => setActiveSection("account")}
                    type="button"
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24">
                      <path d="M19 12H5" />
                      <path d="m12 19-7-7 7-7" />
                    </svg>
                  </button>
                ) : null}
                <span>{title}</span>
              </h1>
              <p className="main-subtitle">
                {activeSection === "linked" ? (
                  <>
                    Connect a tool to an account, or{" "}
                    <button className="inline-text-link" onClick={() => openLinkToolModal()} type="button">
                      Link AI Tool
                    </button>{" "}
                    to get started
                  </>
                ) : (
                  subtitle
                )}
              </p>
            </div>
            <div className="header-actions">
              {activeSection === "account" ? (
                <button className="btn-sm btn-sm-charcoal" onClick={() => setActiveSection("providers")} type="button">
                  + Edit Provider
                </button>
              ) : null}
              {activeSection === "tools" && hasConfirmedCategories ? (
                <>
                  <button className="btn-sm btn-sm-ghost" onClick={openResetToolsFlow} type="button">
                    Reset AI Tools
                  </button>
                  <button className="btn-sm btn-sm-charcoal" onClick={openEditCategoryModal} type="button">
                    Edit Category
                  </button>
                </>
              ) : null}
              {activeSection !== "dashboard" && activeSection !== "billing" ? (
                <button
                  className="btn-sm btn-sm-primary"
                  onClick={activeSection === "account" || activeSection === "providers" ? openAddAccountModal : handleAddToolClick}
                  type="button"
                >
                  {activeSection === "account" || activeSection === "providers"
                    ? "+ Add Account"
                    : activeSection === "linked"
                      ? "+ Link AI Tool"
                      : "+ AI Tool"}
                </button>
              ) : null}
            </div>
          </header>

          {activeSection === "account" ? (
            <section className="account-page">
              {accountList.length > 0 ? (
                <div className="account-page-guidance">
                  <span className="category-view-helper">Hold and drag ⠿ to reorder your accounts.</span>
                </div>
              ) : null}
              {accountDataError ? (
                <div className="data-state-message error" role="alert">
                  {accountDataError}
                </div>
              ) : null}
              <article className="form-card account-table-card">
                <div className="account-table account-database">
                  {isLoadingAccounts ? (
                    <div className="empty-state compact-empty">
                      <strong>Loading accounts</strong>
                      <span>Getting your saved accounts ready.</span>
                    </div>
                  ) : groupedAccounts.length > 0 ? (
                    <>
                      <div className="account-table-head" aria-hidden="true">
                        <span />
                        <span>Nickname</span>
                        <span>Login</span>
                        <span>Action</span>
                      </div>
                      {groupedAccounts.map((group) => (
                        <Fragment key={group.provider}>
                          <div className="account-database-provider-row">
                            <span className="account-row-label">
                              <span>{group.provider}</span>
                              <span>{group.accounts.length}</span>
                            </span>
                          </div>
                          {group.accounts.map((account) => (
                            <div
                              className={
                                draggedAccountLogin === account.login
                                  ? "account-table-row is-dragging"
                                  : "account-table-row"
                              }
                              key={account.login}
                              data-account-login={account.login}
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={(event) => handleAccountDrop(event, account)}
                              onPointerEnter={(event) => {
                                if (event.buttons === 1 && draggedAccountLogin) {
                                  moveAccount(draggedAccountLogin, account.login);
                                }
                              }}
                              onPointerUp={() => setDraggedAccountLogin(null)}
                            >
                              <span className="drag-handle-cell" data-label="Move">
                                <button
                                  aria-label={`Reorder ${account.label}`}
                                  className="drag-handle"
                                  draggable
                                  onDragEnd={() => setDraggedAccountLogin(null)}
                                  onDragStart={(event) => handleAccountDragStart(event, account)}
                                  onPointerDown={(event) => handleAccountPointerDown(event, account)}
                                  type="button"
                                >
                                  <span />
                                  <span />
                                  <span />
                                  <span />
                                  <span />
                                  <span />
                                </button>
                              </span>
                              <div data-label="Nickname">
                                <span className={`email-tag ${account.tag}`}>
                                  <span className="tag-dot" />
                                  {account.label}
                                </span>
                              </div>
                              <span className="account-login-cell" data-label="Login">
                                <button
                                  aria-label={`Copy ${account.login}`}
                                  className="copy-login-button tooltip-target"
                                  data-tooltip="Copy"
                                  onClick={() => copyAccountLogin(account.login)}
                                  type="button"
                                >
                                  <svg aria-hidden="true" viewBox="0 0 24 24">
                                    <rect x="8" y="8" width="10" height="10" rx="2" />
                                    <path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
                                  </svg>
                                </button>
                                <span className="account-login-value">{account.login}</span>
                              </span>
                              <span data-label="Action">
                                <button className="action-btn" onClick={() => openEditAccountModal(account)} type="button">
                                  Edit
                                </button>
                              </span>
                            </div>
                          ))}
                        </Fragment>
                      ))}
                    </>
                  ) : (
                    <div className="empty-state">
                      <strong>Your accounts list is empty</strong>
                      <span>
                        <button className="inline-text-link" onClick={openAddAccountModal} type="button">
                          Add account
                        </button>{" "}
                        to start grouping your AI logins in one place.
                      </span>
                    </div>
                  )}
                </div>
              </article>
            </section>
          ) : activeSection === "providers" ? (
            <section className="account-page">
              <article className="form-card provider-page-card">
                <div className="provider-table provider-database">
                  <div className="provider-table-head" aria-hidden="true">
                    <span>Provider Name</span>
                    <span>Action</span>
                  </div>

                  <div className="provider-database-section-row">
                    <span>Default</span>
                    <span>{defaultProviderRows.length}</span>
                  </div>

                  {defaultProviderRows.map((providerRow) => (
                    <div className="provider-table-row provider-table-row-default" key={providerRow.name}>
                      <span data-label="Provider Name">{providerRow.name}</span>
                    </div>
                  ))}

                  <div className="provider-database-section-row">
                    <span>Custom</span>
                    <span>{customProviderRows.length}</span>
                  </div>

                  {customProviderRows.length > 0 ? (
                    customProviderRows.map((providerRow) => (
                      <div className="provider-table-row" key={providerRow.name}>
                        <span data-label="Provider Name">{providerRow.name}</span>
                        <span data-label="Action">
                          <button
                            className="action-btn"
                            onClick={() => openEditProviderModal(providerRow.name)}
                            type="button"
                          >
                            Edit
                          </button>
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="empty-state compact-empty provider-empty-row">
                      <strong>No custom providers yet</strong>
                      <span>
                        Add one from{" "}
                        <button className="inline-text-link" onClick={openAddAccountModal} type="button">
                          Add Account
                        </button>
                        .
                      </span>
                    </div>
                  )}
                </div>
              </article>
            </section>
          ) : activeSection === "settings" ? (
            <section className="account-page settings-page">
              <div className="settings-profile">
                <section className="settings-section">
                  <header>
                    <h2>Profile</h2>
                    <p>Manage your AI Subprise login.</p>
                  </header>
                  <form className="modal-form" onSubmit={saveNewPassword}>
                    <label className="form-field">
                      <span>Email</span>
                      <input readOnly type="email" value={currentUserEmail || "Not signed in"} />
                    </label>
                    <label className="form-field">
                      <span>New password</span>
                      <input
                        autoComplete="new-password"
                        onChange={(event) => setNewPassword(event.target.value)}
                        placeholder="Enter a new password"
                        type="password"
                        value={newPassword}
                      />
                    </label>
                    {profileError ? (
                      <div className="data-state-message error" role="alert">
                        {profileError}
                      </div>
                    ) : null}
                    {profileMessage ? (
                      <div className="data-state-message" role="status">
                        {profileMessage}
                      </div>
                    ) : null}
                    <div className="welcome-modal-actions settings-profile-actions">
                      <button className="quiet-danger-link" onClick={signOut} type="button">
                        Sign out
                      </button>
                      <button className="btn-sm btn-sm-primary" disabled={isSavingProfile} type="submit">
                        {isSavingProfile ? "Saving..." : "Change password"}
                      </button>
                    </div>
                  </form>
                </section>

                <section className="settings-section">
                  <header>
                    <h2>Preferences</h2>
                    <p>App-wide defaults.</p>
                  </header>
                  <label className="form-field settings-compact-field">
                    <span>Default currency</span>
                    {renderDropdown({
                      id: "settings-default-currency",
                      onChange: (currency) => {
                        const nextCurrency = normaliseCurrency(currency);
                        setDefaultCurrency(nextCurrency);
                        window.localStorage.setItem("ai-subprise-default-currency", nextCurrency);
                      },
                      options: currencyOptions,
                      value: defaultCurrency,
                    })}
                  </label>
                </section>

                <section className="settings-section">
                  <header>
                    <h2>Notifications</h2>
                    <p>Stay ahead of renewals and trials.</p>
                  </header>
                  <div className="settings-toggle-row">
                    <span>Trial &amp; renewal reminders</span>
                    <button
                      aria-pressed={remindersEnabled}
                      className={remindersEnabled ? "settings-toggle is-on" : "settings-toggle"}
                      onClick={() => {
                        const nextValue = !remindersEnabled;
                        setRemindersEnabled(nextValue);
                        window.localStorage.setItem("ai-subprise-reminders-enabled", String(nextValue));
                      }}
                      type="button"
                    >
                      <span />
                      {remindersEnabled ? "On" : "Off"}
                    </button>
                  </div>
                  <label className="form-field settings-compact-field">
                    <span>Remind me</span>
                    {renderDropdown({
                      id: "settings-reminder-days",
                      onChange: (days) => {
                        setReminderDays(days);
                        window.localStorage.setItem("ai-subprise-reminder-days", days);
                      },
                      options: [3, 7, 14].map((days) => ({ label: `${days} days before`, value: String(days) })),
                      value: reminderDays,
                    })}
                  </label>
                </section>
              </div>
            </section>
          ) : activeSection === "dashboard" ? (
            <section className="dashboard-overview" aria-label="Dashboard summary">
              {trialsEndingSoon.length > 0 ? (
                <aside className="trial-alert-banner" aria-label="Trials ending soon">
                  <div>
                    <strong>{trialsEndingSoon.length} {trialsEndingSoon.length === 1 ? "trial" : "trials"} ending soon</strong>
                    <span>Review trial accounts that expire within {reminderDays} days.</span>
                  </div>
                  <div className="trial-alert-list">
                    {trialsEndingSoon.slice(0, 3).map((trial) => (
                      <span key={`${trial.tool.id}-${trial.accountLabel}`}>
                        {trial.tool.name} · {trial.accountLabel} · {formatShortDate(trial.expiryDate)}
                      </span>
                    ))}
                  </div>
                </aside>
              ) : null}
              <div className="stats-grid">
                <article className="stat-card accent">
                  <div className="stat-icon">A</div>
                  <div className="stat-value">{toolsWithValidAccountLinks.length}</div>
                  <div className="stat-label">Total AI tools</div>
                </article>
                <article className="stat-card">
                  <div className="stat-icon">P</div>
                  <div className="stat-value">{paidToolCount}</div>
                  <div className="stat-label">Paid plans</div>
                </article>
                <article className="stat-card">
                  <div className="stat-icon">T</div>
                  <div className="stat-value">{trialToolCount}</div>
                  <div className="stat-label">Active trials</div>
                </article>
                <article className="stat-card">
                  <div className="stat-icon">E</div>
                  <div className="stat-value">{accountList.length}</div>
                  <div className="stat-label">Accounts</div>
                </article>
              </div>
            </section>
          ) : (
            <>
              <section className="table-section">
                {activeSection === "tools" || activeSection === "linked" || activeSection === "watchlist" || activeSection === "billing" ? (
                  <div className="table-controls">
                    <div
                      className={activeSection === "tools" && activeCategory ? "category-view-tabs subcategory-view-tabs" : "category-view-tabs"}
                      aria-label={activeSection === "billing" ? "Billing views" : "Category views"}
                    >
                      <span className="category-view-helper" aria-hidden={activeSection === "tools" && Boolean(activeCategory)}>
                        {activeSection === "tools" && activeCategory
                          ? "\u00a0"
                          : activeSection === "billing"
                            ? "Browse by billing."
                            : "Browse by type."}
                      </span>
                      <div className="category-view-action-row">
                        {activeSection === "billing" ? (
                          <div className="category-view-tab-list">
                            {[
                              { label: "All", value: "All" as const },
                              { label: "By Month", value: "Month" as const },
                            ].map((option) => (
                              <button
                                className={selectedBillingView === option.value ? "category-view-tab active" : "category-view-tab"}
                                key={option.value}
                                onClick={() => setSelectedBillingView(option.value)}
                                type="button"
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        ) : activeSection === "tools" && activeCategory ? (
                          <span className="category-view-tab-spacer" aria-hidden="true" />
                        ) : (
                          <div className="category-view-tab-list">
                            {availableToolSortOptions.map((option) => (
                              <button
                                className={selectedToolSort === option.value ? "category-view-tab active" : "category-view-tab"}
                                key={option.value}
                                onClick={() => setSelectedToolSort(option.value)}
                                type="button"
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        )}
                        <label className="search-box">
                          <span className="search-icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24">
                              <circle cx="11" cy="11" r="6" />
                              <path d="m16 16 4 4" />
                            </svg>
                          </span>
                          <input
                            onChange={(event) => setToolSearchQuery(event.target.value)}
                            placeholder="search tool"
                            type="search"
                            value={toolSearchQuery}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                ) : null}

                {toolDataError ? (
                  <div className="data-state-message error" role="alert">
                    {toolDataError}
                  </div>
                ) : null}

                {(activeSection === "tools" || activeSection === "watchlist" || activeSection === "archive") && selectedVisibleToolIds.length > 0 ? (
                  <div className="bulk-action-bar" role="status">
                    <span>{selectedVisibleToolIds.length} selected</span>
                    {activeSection !== "archive" ? (
                      <button className="bulk-action-btn" onClick={() => archiveToolIds(selectedVisibleToolIds)} type="button">
                        Archive
                      </button>
                    ) : null}
                    <button
                      className="bulk-action-btn danger"
                      onClick={() => {
                        if (activeSection === "archive") {
                          permanentlyDeleteToolIds(selectedVisibleToolIds);
                          return;
                        }

                        deleteToolIds(selectedVisibleToolIds);
                      }}
                      type="button"
                    >
                      Delete
                    </button>
                    <button className="bulk-action-btn ghost" onClick={clearToolSelection} type="button">
                      Clear
                    </button>
                  </div>
                ) : null}

                <div
                  className={
                    [
                      "account-table",
                      "tool-database",
                      `tool-database-${activeSection}`,
                      !(["tools", "linked", "watchlist"] as Section[]).includes(activeSection) || activeCategory || selectedToolSort !== "Category" ? "tool-database-flat" : "",
                      activeSection === "tools" && (activeCategory || selectedToolSort !== "Category") ? "tool-database-tools-flat-view" : "",
                    ].filter(Boolean).join(" ")
                  }
                >
                  {activeSection === "billing" ? (
                    <>
                      <div className="account-table-head tool-table-head">
                        <span>Tool Name</span>
                        <span>Account</span>
                        <span>Plan Name</span>
                        <span>Billing Type</span>
                        <span>Amount</span>
                        <span>Next Charge</span>
                        <span>Action</span>
                      </div>
                      {isLoadingTools ? (
                        <div className="empty-state tool-onboarding-empty">
                          <strong>Loading billing</strong>
                          <span>Getting your paid subscriptions ready.</span>
                        </div>
                      ) : billingRows.length > 0 ? (
                        billingRows.map((row, rowIndex) => {
                          const previousRow = billingRows[rowIndex - 1];
                          const isContinuation = Boolean(
                            previousRow &&
                            previousRow.tool.id === row.tool.id &&
                            previousRow.accountLabel === row.accountLabel,
                          );
                          return renderBillingRow(row, isContinuation);
                        })
                      ) : (
                        <div className="empty-state tool-onboarding-empty">
                          <strong>No paid subscriptions yet</strong>
                          <span>
                            <button className="inline-text-link" onClick={() => openLinkToolModal()} type="button">
                              Link an account
                            </button>{" "}
                            with a Paid plan to see it here.
                          </span>
                        </div>
                      )}
                    </>
                  ) : (activeSection === "tools" || activeSection === "linked" || activeSection === "watchlist") &&
                    workspaceCategories.length > 0 &&
                    !activeCategory &&
                    selectedToolSort === "Category" &&
                    (activeSection === "tools"
                      ? totalToolboxCount > 0
                      : activeSection === "linked"
                        ? totalLinkedToolCount > 0
                        : visibleTools.length > 0) ? (
                    <>
                      <div className="account-table-head tool-table-head">
                        {activeSection === "linked" ? (
                          <>
                            <span />
                            <span aria-label="Favourite" className="tool-head-icon"><svg aria-hidden="true" viewBox="0 0 24 24"><FavoriteStarIconPaths /></svg></span>
                            <span>Tool Name</span>
                            <span>Account</span>
                            <span>Plan</span>
                            <span>Action</span>
                          </>
                        ) : (
                          <>
                            <span />
                            <span aria-label="Favourite" className="tool-head-icon"><svg aria-hidden="true" viewBox="0 0 24 24"><FavoriteStarIconPaths /></svg></span>
                            <span>Tool Name</span>
                            <span>Category</span>
                            <span>URL</span>
                            <span aria-label="Watchlist" className="tool-head-icon">
                              <svg aria-hidden="true" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"><path d="M4 12s2.8-5 8-5 8 5 8 5-2.8 5-8 5-8-5-8-5Z" /><circle cx="12" cy="12" r="2.2" /></g></svg>
                            </span>
                            <span>Action</span>
                          </>
                        )}
                      </div>
                      {groupedToolCategories.length > 0 ? (
                        groupedToolCategories.map((group) => (
                          <Fragment key={group.category}>
                            <div className="tool-category-row-header">
                              <span className="category-row-label">
                                <span>{group.category}</span>
                                <span>{group.tools.length}</span>
                              </span>
                              {group.tools.length > 0 ? (
                                <button
                                  onClick={() => {
                                    const groupToolIds = group.tools.map((tool) => tool.id);
                                    const areAllGroupToolsSelected = groupToolIds.every((toolId) => selectedToolIds.includes(toolId));
                                    setSelectedToolIds((currentIds) => {
                                      const groupIds = new Set(groupToolIds);
                                      if (areAllGroupToolsSelected) {
                                        return currentIds.filter((toolId) => !groupIds.has(toolId));
                                      }

                                      return Array.from(new Set([...currentIds, ...groupToolIds]));
                                    });
                                  }}
                                  type="button"
                                >
                                  Select all
                                </button>
                              ) : null}
                            </div>
                            {group.tools.length > 0 ? (
                              group.tools.map((tool) => renderToolRow(tool))
                            ) : (
                              <div className="empty-state compact-empty category-empty-state">
                                <span className="plain-empty-copy">
                                  {activeSection === "watchlist"
                                    ? `Nothing on your ${group.category} radar yet`
                                    : activeSection === "linked"
                                      ? "No linked tools yet"
                                      : `No tools on your ${group.category} yet`}
                                </span>
                              </div>
                            )}
                          </Fragment>
                        ))
                      ) : (
                        <div className="empty-state tool-onboarding-empty">
                          <strong>{toolboxEmptyState.title}</strong>
                          {toolboxEmptyState.body}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="account-table-head tool-table-head">
                        {activeSection === "linked" ? (
                          <>
                            <span>
                              <input
                                aria-label="Select all visible tools"
                                checked={areAllVisibleToolsSelected}
                                className="tool-row-checkbox"
                                onChange={toggleVisibleToolSelection}
                                type="checkbox"
                              />
                            </span>
                            <span aria-label="Favourite" className="tool-head-icon">
                              <svg aria-hidden="true" viewBox="0 0 24 24">
                                <FavoriteStarIconPaths />
                              </svg>
                            </span>
                            <span>Tool Name</span>
                            <span>Account</span>
                            <span>Plan</span>
                            <span>Action</span>
                          </>
                        ) : activeSection === "favorites" ? (
                          <>
                            <span />
                            <span aria-label="Favourite" className="tool-head-icon">
                              <svg aria-hidden="true" viewBox="0 0 24 24">
                                <FavoriteStarIconPaths />
                              </svg>
                            </span>
                            <span>Tool Name</span>
                            <span>Category</span>
                            <span>Account Used</span>
                            <span>URL</span>
                            <span>Action</span>
                          </>
                        ) : activeSection === "archive" ? (
                          <>
                            <span>
                              <input
                                aria-label="Select all visible tools"
                                checked={areAllVisibleToolsSelected}
                                className="tool-row-checkbox"
                                onChange={toggleVisibleToolSelection}
                                type="checkbox"
                              />
                            </span>
                            <span>Tool Name</span>
                            <span>Category</span>
                            <span>Last Status</span>
                            <span>Archived On</span>
                            <span>Action</span>
                          </>
                        ) : (
                          <>
                            <span>
                              <input
                                aria-label="Select all visible tools"
                                checked={areAllVisibleToolsSelected}
                                className="tool-row-checkbox"
                                onChange={toggleVisibleToolSelection}
                                type="checkbox"
                              />
                            </span>
                            <span aria-label="Favourite" className="tool-head-icon">
                              <svg aria-hidden="true" viewBox="0 0 24 24">
                                <FavoriteStarIconPaths />
                              </svg>
                            </span>
                            <span>Tool Name</span>
                            <span>Category</span>
                          <span>URL</span>
                          <span aria-label="Watchlist" className="tool-head-icon">
                            <svg aria-hidden="true" viewBox="0 0 24 24">
                              <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
                                <path d="M4 12s2.8-5 8-5 8 5 8 5-2.8 5-8 5-8-5-8-5Z" />
                                <circle cx="12" cy="12" r="2.2" />
                              </g>
                            </svg>
                          </span>
                          <span>Action</span>
                          </>
                        )}
                      </div>
                      {isLoadingTools ? (
                        <div className="empty-state tool-onboarding-empty">
                          <strong>Loading AI tools</strong>
                          <span>Getting your toolbox ready.</span>
                        </div>
                      ) : visibleTools.length > 0 ? (
                        visibleTools.map((tool) => renderToolRow(tool))
                      ) : (
                        <div className="empty-state tool-onboarding-empty">
                          {activeSection === "watchlist" && activeCategory ? (
                            <span className="plain-empty-copy">{`Nothing on your ${activeCategory} radar yet`}</span>
                          ) : (
                            <strong>
                              {activeSection === "tools"
                                ? toolboxEmptyState.title
                                : activeSection === "linked"
                                  ? linkedEmptyState.title
                                  : activeSection === "watchlist"
                                    ? "No watchlist yet"
                                    : activeSection === "favorites"
                                      ? "No favourites yet"
                                      : activeSection === "archive"
                                        ? "Nothing archived yet"
                                        : "No tools yet"}
                            </strong>
                          )}
                          {activeSection === "tools" ? (
                            toolboxEmptyState.body
                          ) : activeSection === "linked" ? (
                            linkedEmptyState.body
                          ) : activeSection === "watchlist" ? (
                            <span>
                              {activeCategory
                                ? `Nothing on your ${activeCategory} radar yet.`
                                : "Nothing on your radar yet."}
                            </span>
                          ) : activeSection === "favorites" ? (
                            <span>Star any tool in your toolbox to save it here for quick access.</span>
                          ) : activeSection === "archive" ? (
                            <span>Tools you archive will be stored here. Out of sight, not gone.</span>
                          ) : (
                            <span>Add or move tools into this view when you are ready.</span>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </section>
            </>
          )}
        </section>
      </div>

      {showCreateAccountModal && (
        <div className="welcome-modal-overlay" role="presentation">
          <section aria-labelledby="welcome-modal-title" aria-modal="true" className="welcome-modal" role="dialog">
            <div className="welcome-modal-icon">AI</div>
            <h2 id="welcome-modal-title">Start by adding your first account.</h2>
            <p>
              Add the account you use most often, then link your AI tools to it as you build your directory.
            </p>
            <div className="welcome-modal-actions">
              <button className="btn-sm btn-sm-ghost" onClick={dismissCreateAccountModal} type="button">
                Not now
              </button>
              <button className="btn-sm btn-sm-primary" onClick={openAccountSetup} type="button">
                Go to My Account
              </button>
            </div>
          </section>
        </div>
      )}

      {showRoleQuestionModal && (
        <div className="welcome-modal-overlay" role="presentation">
          <section aria-labelledby="role-question-modal-title" aria-modal="true" className="welcome-modal" role="dialog">
            <button
              aria-label="Close role question modal"
              className="modal-close-button"
              onClick={() => setShowRoleQuestionModal(false)}
              type="button"
            >
              x
            </button>
            <h2 id="role-question-modal-title">Start with a template</h2>
            <p>This just shapes your setup, you can always edit later.</p>
            <div className="modal-question-label">What best describes you?</div>
            <div className="role-radio-list">
              {roleOptions.map((role) => (
                <label className="role-radio-option" key={role}>
                  <input
                    checked={roleQuestionChoice === role}
                    onChange={() => chooseRoleAndPreview(role)}
                    type="radio"
                    value={role}
                  />
                  <span>{role}</span>
                </label>
              ))}
            </div>
          </section>
        </div>
      )}

      {showCategoryPreviewModal && (
        <div className="welcome-modal-overlay" role="presentation">
          <section
            aria-labelledby="category-preview-modal-title"
            aria-modal="true"
            className="welcome-modal category-preview-modal"
            role="dialog"
          >
            <button
              aria-label="Close category preview modal"
              className="modal-close-button"
              onClick={() => setShowCategoryPreviewModal(false)}
              type="button"
            >
              x
            </button>
            <h2 id="category-preview-modal-title">Choose your categories</h2>
            <p>Review the suggested categories for your workspace.</p>
            <div className="category-matrix-wrap">
              <div className="category-matrix" style={{ "--active-role-offset": roleOptions.indexOf(selectedRole) } as CSSProperties}>
                <div className="category-matrix-highlight" aria-hidden="true" />
                <div className="category-matrix-head category-name-head">
                  <span>Category</span>
                  <button
                    aria-label="View category descriptions"
                    className="category-info-button tooltip-target"
                    data-tooltip="Category guide"
                    onClick={() => setShowCategoryInfoModal(true)}
                    type="button"
                  >
                    i
                  </button>
                </div>
                {roleOptions.map((role) => (
                  <div className="category-matrix-head" key={role}>
                    {role}
                  </div>
                ))}
                {defaultToolCategories.map((category) => (
                  <Fragment key={category}>
                    <div className="category-matrix-cell category-name-cell">{category}</div>
                    {roleOptions.map((role) => (
                      <div className="category-matrix-cell category-role-cell" key={`${category}-${role}`}>
                        {role === "Custom" && selectedRole === "Custom" ? (
                          <input
                            aria-label={`Custom category ${category}`}
                            checked={selectedRoleCategories.includes(category)}
                            onChange={() => togglePreviewCategory(category)}
                            type="checkbox"
                          />
                        ) : roleCategoryMap[role].includes(category) ? (
                          <span className="matrix-tick">✓</span>
                        ) : null}
                      </div>
                    ))}
                  </Fragment>
                ))}
                <div className="category-matrix-radio-spacer" aria-hidden="true" />
                {roleOptions.map((role) => (
                  <label className="category-matrix-radio-cell" key={`role-radio-${role}`}>
                    <input
                      aria-label={role}
                      checked={selectedRole === role}
                      onChange={() => switchPreviewRole(role)}
                      type="radio"
                      value={role}
                    />
                  </label>
                ))}
              </div>
            </div>
            <div className="welcome-modal-actions">
              <button className="btn-sm btn-sm-primary" onClick={saveRoleCategories} type="button">
                Confirm
              </button>
            </div>
          </section>
        </div>
      )}

      {showCategoryInfoModal && (
        <div className="welcome-modal-overlay" role="presentation">
          <section
            aria-labelledby="category-info-modal-title"
            aria-modal="true"
            className="welcome-modal category-info-modal"
            role="dialog"
          >
            <h2 id="category-info-modal-title">Category guide</h2>
            <div className="category-info-table">
              {defaultToolCategories.map((category) => (
                <Fragment key={`info-${category}`}>
                  <span>{category}</span>
                  <span>{categoryDescriptions[category]}</span>
                </Fragment>
              ))}
            </div>
            <div className="welcome-modal-actions">
              <button className="btn-sm btn-sm-primary" onClick={() => setShowCategoryInfoModal(false)} type="button">
                Got it
              </button>
            </div>
          </section>
        </div>
      )}

      {showEditCategoryModal && (
        <div className="welcome-modal-overlay" role="presentation">
          <section
            aria-labelledby="edit-category-modal-title"
            aria-modal="true"
            className={
              categoryDeleteWarning
                ? "welcome-modal compact-copy-modal delete-account-modal category-delete-danger-modal"
                : "welcome-modal compact-copy-modal"
            }
            role="dialog"
          >
            <button
              aria-label="Close edit category modal"
              className="modal-close-button"
              onClick={() => {
                if (categoryDeleteWarning) {
                  setCategoryDeleteWarning(null);
                  return;
                }

                persistCategoryDrafts(categoryDrafts, { closeModal: true });
              }}
              type="button"
            >
              x
            </button>
            {categoryDeleteWarning ? (
              <div className="category-delete-confirmation">
                <div className="delete-account-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <TrashIconPaths />
                  </svg>
                </div>
                <h2 id="edit-category-modal-title">Delete "{categoryDeleteWarning.category}"?</h2>
                <p className="reset-danger-copy">
                  <span>
                    This category has {categoryDeleteWarning.toolCount} AI{" "}
                    {categoryDeleteWarning.toolCount === 1 ? "tool" : "tools"} in it.
                  </span>
                  <span>
                    Deleting the category will also delete{" "}
                    {categoryDeleteWarning.toolCount === 1 ? "it" : "them"}. This can&apos;t be undone.
                  </span>
                </p>
                <div className="welcome-modal-actions category-delete-confirmation-actions">
                  <button className="btn-sm btn-sm-ghost" onClick={() => setCategoryDeleteWarning(null)} type="button">
                    Cancel
                  </button>
                  <button className="btn-sm btn-sm-danger" onClick={confirmCategoryDraftDelete} type="button">
                    Delete category
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h2 id="edit-category-modal-title">Edit Category</h2>
                <p>Hold and drag ⠿ to reorder. Rename or delete categories to fit your workflow</p>
                <form className="modal-form" onSubmit={saveEditedCategories}>
                  <div className="category-edit-list">
                    {categoryDrafts.map((category, index) => (
                      <div
                        className={[
                          "category-edit-row",
                          "form-field",
                          draggedCategoryIndex === index ? "is-dragging" : "",
                        ].filter(Boolean).join(" ")}
                        data-category-index={index}
                        key={`category-draft-${index}`}
                        onDragEnter={(event) => handleCategoryDraftDragEnter(event, index)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => handleCategoryDraftDrop(event, index)}
                        onPointerEnter={(event) => {
                          if (event.buttons === 1 && draggedCategoryIndex !== null) {
                            moveCategoryDraft(draggedCategoryIndex, index);
                          }
                        }}
                        onPointerUp={() => setDraggedCategoryIndex(null)}
                      >
                        <div className="category-edit-field">
                          <button
                            aria-label={`Reorder ${category}`}
                            className="drag-handle category-drag-handle"
                            draggable
                            onDragEnd={() => setDraggedCategoryIndex(null)}
                            onDragStart={(event) => handleCategoryDraftDragStart(event, index)}
                            onPointerDown={(event) => handleCategoryDraftPointerDown(event, index)}
                            type="button"
                          >
                            <span />
                            <span />
                            <span />
                            <span />
                            <span />
                            <span />
                          </button>
                          <input
                            aria-label={`Edit ${category}`}
                            onChange={(event) => updateCategoryDraft(index, event.target.value)}
                            placeholder="AI Assistant"
                            type="text"
                            value={category}
                          />
                          <button
                            aria-label={`Delete ${category}`}
                            className="category-icon-button danger"
                            onClick={() => deleteCategoryDraft(index)}
                            type="button"
                          >
                            <svg aria-hidden="true" viewBox="0 0 24 24">
                              <TrashIconPaths />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <label className="category-add-row form-field">
                    <span>Add new category</span>
                    <div className="category-add-controls">
                      <input
                        onChange={(event) => setNewCategoryName(formatNickname(event.target.value))}
                        placeholder="Data & Analytics"
                        type="text"
                        value={newCategoryName}
                      />
                      <button className="btn-sm btn-sm-primary" onClick={addCategoryDraft} type="button">
                        Add
                      </button>
                    </div>
                  </label>
                </form>
              </>
            )}
          </section>
        </div>
      )}

      {showResetArchiveWarning && archiveToolCount(toolResetArchives) > 0 ? (
        <div className="welcome-modal-overlay" role="presentation">
          <section aria-labelledby="reset-warning-modal-title" aria-modal="true" className="welcome-modal" role="dialog">
            <h2 id="reset-warning-modal-title">Previous Reset Found</h2>
            <p>
              You have {archiveToolCount(toolResetArchives)} tools from previous resets that have not been restored. Resetting
              now will remove them permanently.
            </p>
            <div className="welcome-modal-actions">
              <button className="btn-sm btn-sm-ghost" onClick={() => setShowResetArchiveWarning(false)} type="button">
                Cancel
              </button>
              <button className="btn-sm btn-sm-danger" onClick={continueResetAfterArchiveWarning} type="button">
                Continue Reset
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {showResetTypeModal && (
        <div className="welcome-modal-overlay" role="presentation">
          <section aria-labelledby="reset-type-modal-title" aria-modal="true" className="welcome-modal compact-copy-modal" role="dialog">
            <button
              aria-label="Close reset modal"
              className="modal-close-button"
              onClick={() => setShowResetTypeModal(false)}
              type="button"
            >
              x
            </button>
            <h2 id="reset-type-modal-title">Reset AI Tools</h2>
            <p>Choose how to rebuild your AI tool directory.</p>
            <div className="reset-choice-list">
              <button className="reset-choice-card" onClick={() => requestResetConfirmation("blank")} type="button">
                <strong>Start from scratch</strong>
                <span>Clear active tools and categories so you can rebuild manually.</span>
              </button>
              <button className="reset-choice-card" onClick={() => requestResetConfirmation("template")} type="button">
                <strong>Choose a new template</strong>
                <span>Clear active tools, then reopen the role template selection flow.</span>
              </button>
            </div>
          </section>
        </div>
      )}

      {showResetDangerModal && pendingResetMode ? (
        <div className="welcome-modal-overlay" role="presentation">
          <section
            aria-labelledby="reset-danger-modal-title"
            aria-modal="true"
            className="welcome-modal delete-account-modal"
            role="dialog"
          >
            <div className="delete-account-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <TrashIconPaths />
              </svg>
            </div>
            <h2 id="reset-danger-modal-title">Reset AI Tools?</h2>
            <p className="reset-danger-copy">
              <span>These tools will be removed from AI Subprise on all your devices.</span>
              <span>They&apos;ll be in <strong>Recently Deleted</strong> for 30 days.</span>
            </p>
            <div className="welcome-modal-actions">
              <button
                className="btn-sm btn-sm-ghost"
                onClick={() => {
                  setPendingResetMode(null);
                  setShowResetDangerModal(false);
                }}
                type="button"
              >
                Cancel
              </button>
              <button className="btn-sm btn-sm-danger" onClick={confirmPendingReset} type="button">
                Reset AI Tools
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {confirmToolStateChange ? (
        <div className="welcome-modal-overlay" role="presentation">
          <section
            aria-labelledby="tool-state-confirm-modal-title"
            aria-modal="true"
            className="welcome-modal"
            role="dialog"
          >
            <button
              aria-label="Close confirmation modal"
              className="modal-close-button"
              onClick={() => setConfirmToolStateChange(null)}
              type="button"
            >
              x
            </button>
            <h2 id="tool-state-confirm-modal-title">
              {confirmToolStateChange.action === "unfavorite" ? "Remove from Favourites?" : "Unarchive Tool?"}
            </h2>
            <p>
              {confirmToolStateChange.action === "unfavorite" ? (
                <>
                  <strong>{confirmToolStateChange.tool.name}</strong> will no longer appear on your Favourites page.
                </>
              ) : (
                <>
                  <strong>{confirmToolStateChange.tool.name}</strong> will return to AI Toolbox.
                </>
              )}
            </p>
            <div className="welcome-modal-actions">
              <button className="btn-sm btn-sm-ghost" onClick={() => setConfirmToolStateChange(null)} type="button">
                Cancel
              </button>
              <button className="btn-sm btn-sm-primary" onClick={confirmPendingToolStateChange} type="button">
                {confirmToolStateChange.action === "unfavorite" ? "Remove" : "Unarchive"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {watchlistMoveTool ? (
        <div className="welcome-modal-overlay" role="presentation">
          <section
            aria-labelledby="watchlist-move-modal-title"
            aria-modal="true"
            className="welcome-modal"
            role="dialog"
          >
            <button
              aria-label="Close move to Linked modal"
              className="modal-close-button"
              onClick={() => setWatchlistMoveTool(null)}
              type="button"
            >
              x
            </button>
            <h2 id="watchlist-move-modal-title">Move to Linked?</h2>
            <p>
              Link <strong>{watchlistMoveTool.name}</strong> to an account so it appears on the Linked page.
            </p>
            <div className="welcome-modal-actions">
              <button className="btn-sm btn-sm-ghost" onClick={() => setWatchlistMoveTool(null)} type="button">
                Cancel
              </button>
              <button className="btn-sm btn-sm-primary" onClick={confirmMoveWatchlistToolToLinked} type="button">
                Continue
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {showAddAccountModal && (
        <div className="welcome-modal-overlay" role="presentation">
          <section aria-labelledby="add-account-modal-title" aria-modal="true" className="welcome-modal" role="dialog">
            <button
              aria-label="Close add account modal"
              className="modal-close-button"
              onClick={() => {
                setIsColourMenuOpen(false);
                setEditingAccount(null);
                setShowAddAccountModal(false);
              }}
              type="button"
            >
              ×
            </button>
            {editingAccount ? (
              <button
                aria-label="Delete account"
                className="modal-trash-button"
                onClick={() => {
                  setShowAddAccountModal(false);
                  setDeletingAccount(editingAccount);
                }}
                type="button"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <TrashIconPaths />
                </svg>
              </button>
            ) : null}
            <h2 id="add-account-modal-title">{editingAccount ? "Edit Account" : "New Account Entry"}</h2>
            <form className="modal-form" onSubmit={saveAccount}>
              {accountDataError ? (
                <div className="data-state-message error" role="alert">
                  {accountDataError}
                </div>
              ) : null}
              <label className="form-field">
                <span>Nickname</span>
                <input
                  ref={nicknameInputRef}
                  onChange={(event) => {
                    const nextNickname = event.target.value;
                    const isOverflowing = nextNickname.length > accountNicknameMaxLength;
                    setHasAttemptedNicknameOverflow(isOverflowing || (
                      hasAttemptedNicknameOverflow && nextNickname.length === accountNicknameMaxLength
                    ));
                    setNickname(formatNickname(nextNickname.slice(0, accountNicknameMaxLength)));
                  }}
                  placeholder="Personal, Work, Dev, Burner, Client..."
                  type="text"
                  value={nickname}
                />
                <span className="nickname-feedback-row">
                  {nicknameRequiredError || nicknameDuplicateError || hasAttemptedNicknameOverflow ? (
                    <small className="field-feedback error">
                      {nicknameRequiredError || nicknameDuplicateError || `Max ${accountNicknameMaxLength} characters`}
                    </small>
                  ) : <span />}
                  <small aria-live="polite" className="nickname-character-count">
                    {nickname.length}/{accountNicknameMaxLength}
                  </small>
                </span>
              </label>
              <div className="form-field">
                <span>Colour</span>
                <div className={isColourMenuOpen ? "colour-menu is-open" : "colour-menu"}>
                  <button
                    aria-expanded={isColourMenuOpen}
                    className="colour-menu-trigger"
                    onClick={() => setIsColourMenuOpen((isOpen) => !isOpen)}
                    type="button"
                  >
                    <span className={`colour-swatch ${selectedColour.className}`} />
                    {selectedColour.label}
                  </button>
                  {isColourMenuOpen && (
                    <div className="colour-options">
                      {colourOptions.map((option) => (
                        <button
                          className={
                            selectedColour.label === option.label
                              ? "colour-option is-selected"
                              : "colour-option"
                          }
                          key={option.label}
                          onClick={() => {
                            setSelectedColour(option);
                            setIsColourMenuOpen(false);
                          }}
                          type="button"
                        >
                          <span className={`colour-swatch ${option.className}`} />
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <label className="form-field">
                <span>Provider</span>
                {isCustomProviderMode ? (
                  <input
                    onChange={(event) => updateAccountProvider(formatNickname(event.target.value))}
                    placeholder="Provider name"
                    type="text"
                    value={provider}
                  />
                ) : (
                  renderDropdown({
                    id: "account-provider",
                    onChange: (nextProvider) => {
                      if (nextProvider === customProviderOption) {
                        setIsCustomProviderMode(true);
                        updateAccountProvider("");
                        return;
                      }

                      updateAccountProvider(nextProvider);
                    },
                    options: [
                      ...providerOptions.map((providerOption) => ({
                        label: providerOption,
                        value: providerOption,
                      })),
                      { label: customProviderOption, value: customProviderOption },
                    ],
                    placeholder: "Select provider",
                    value: provider,
                  })
                )}
                {providerRequiredError ? <small className="field-feedback error">{providerRequiredError}</small> : null}
              </label>
              <label className="form-field">
                <span>Login</span>
                <input
                  onChange={(event) => setLogin(event.target.value)}
                  placeholder="you@example.com or github.com/username"
                  type="text"
                  value={login}
                />
                {loginRequiredError ? (
                  <small className="field-feedback error">{loginRequiredError}</small>
                ) : loginDuplicateError ? (
                  <small className="field-feedback error">{loginDuplicateError}</small>
                ) : visibleLoginFeedback ? (
                  <small
                    className={visibleLoginFeedback.type === "error" ? "field-feedback error" : "field-feedback success"}
                  >
                    {visibleLoginFeedback.type === "success" ? (
                      <span aria-hidden="true" className="field-check" />
                    ) : null}
                    {visibleLoginFeedback.message}
                  </small>
                ) : null}
              </label>
              <div className="welcome-modal-actions account-modal-actions">
                {!editingAccount ? (
                  <button
                    className="btn-sm btn-sm-charcoal"
                    disabled={isSavingAccount}
                    onClick={() => saveAccount(undefined, { addAnother: true })}
                    type="button"
                  >
                    + Add next
                  </button>
                ) : null}
                <button className="btn-sm btn-sm-primary" disabled={isSavingAccount} type="submit">
                  {isSavingAccount ? "Saving..." : editingAccount ? "Save changes" : "Save account"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {accountToast ? (
        <div className="app-toast app-toast-success" role="status">
          {accountToast}
        </div>
      ) : null}

      {showAddToolModal && (
        <div className="welcome-modal-overlay" role="presentation">
          <section aria-labelledby="add-tool-modal-title" aria-modal="true" className="welcome-modal" role="dialog">
            {editingTool ? (
              <>
                <button
                  aria-label="Delete AI tool"
                  className="modal-tool-action-button modal-tool-trash-button"
                  onClick={deleteEditingTool}
                  type="button"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24">
                    <TrashIconPaths />
                  </svg>
                </button>
                <button
                  aria-label="Archive AI tool"
                  className="modal-tool-action-button modal-tool-archive-button"
                  onClick={archiveEditingTool}
                  type="button"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24">
                    <ArchiveBoxIconPaths />
                  </svg>
                </button>
              </>
            ) : null}
            <button
              aria-label="Close AI tool modal"
              className="modal-close-button"
              onClick={() => {
                setEditingTool(null);
                setShowAddToolModal(false);
              }}
              type="button"
            >
              x
            </button>
            <h2 id="add-tool-modal-title">{editingTool ? "Edit AI Tool" : "New AI Tool"}</h2>
            <form className="modal-form" onSubmit={saveTool}>
              {toolDataError ? (
                <div className="data-state-message error" role="alert">
                  {toolDataError}
                </div>
              ) : null}
              <label className="form-field">
                <span>AI Tool Name</span>
                <input
                  ref={toolNameInputRef}
                  onChange={(event) => setToolName(displayToolName(event.target.value))}
                  placeholder="ChatGPT, Claude, Midjourney..."
                  type="text"
                  value={toolName}
                />
                {toolNameRequiredError ? (
                  <small className="field-feedback error">{toolNameRequiredError}</small>
                ) : toolNameDuplicateError ? (
                  <small className="field-feedback error">{toolNameDuplicateError}</small>
                ) : null}
              </label>
              <label className="form-field">
                <span>Category</span>
                {isCustomCategoryMode ? (
                  <input
                    onChange={(event) => setToolCategory(formatNickname(event.target.value))}
                    placeholder="Category name"
                    type="text"
                    value={toolCategory}
                  />
                ) : (
                  renderDropdown({
                    id: "tool-category",
                    onChange: (nextCategory) => {
                      if (nextCategory === customCategoryOption) {
                        setIsCustomCategoryMode(true);
                        setToolCategory("");
                        return;
                      }

                      setToolCategory(nextCategory);
                    },
                    options: [
                      ...toolCategoryOptions.map((categoryOption) => ({
                        label: categoryOption,
                        value: categoryOption,
                      })),
                      { label: customCategoryOption, value: customCategoryOption },
                    ],
                    placeholder: "Select category",
                    value: toolCategory,
                  })
                )}
                {toolCategoryRequiredError ? <small className="field-feedback error">{toolCategoryRequiredError}</small> : null}
              </label>
              <label className="form-field">
                <span>URL (optional)</span>
                <input
                  onChange={(event) => setToolUrl(event.target.value)}
                  placeholder="https://example.com"
                  type="url"
                  value={toolUrl}
                />
              </label>
              <div className="welcome-modal-actions account-modal-actions">
                {!editingTool ? (
                  <button
                    className="btn-sm btn-sm-charcoal"
                    disabled={isSavingTool}
                    onClick={() => saveTool(undefined, { addAnother: true })}
                    type="button"
                  >
                    + Add next
                  </button>
                ) : null}
                <button className="btn-sm btn-sm-primary" disabled={isSavingTool} type="submit">
                  {isSavingTool ? "Saving..." : editingTool ? "Save changes" : "Save AI tool"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {showLinkToolModal ? (
        <div className="welcome-modal-overlay" role="presentation">
          <section aria-labelledby="link-tool-modal-title" aria-modal="true" className="welcome-modal link-tool-modal" role="dialog">
            <button
              aria-label="Close link AI tool modal"
              className="modal-close-button"
              onClick={closeLinkToolModal}
              type="button"
            >
              x
            </button>
            <h2 id="link-tool-modal-title">Link AI Tool</h2>
            <form className="modal-form" onSubmit={saveToolLink}>
              <label className="form-field">
                <span>Tool</span>
                {isLinkToolLocked && selectedLinkTool ? (
                  <div className="link-tool-locked-field">
                    <span className="tool-avatar" style={{ background: selectedLinkTool.logoBg }}>
                      {toolInitials(selectedLinkTool.name)}
                    </span>
                    <span>{displayToolName(selectedLinkTool.name)}</span>
                  </div>
                ) : (
                  <div
                    className="link-tool-combobox"
                    onBlur={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                        setIsLinkToolPickerOpen(false);
                      }
                    }}
                  >
                    <div className="link-tool-combobox-field">
                      {selectedLinkTool ? (
                        <span className="tool-avatar" style={{ background: selectedLinkTool.logoBg }}>
                          {toolInitials(selectedLinkTool.name)}
                        </span>
                      ) : null}
                      <input
                        onChange={(event) => {
                          setOpenDropdownId(null);
                          setLinkToolSearchQuery(event.target.value);
                          setLinkToolId("");
                          setIsLinkToolPickerOpen(true);
                        }}
                        onFocus={() => {
                          setOpenDropdownId(null);
                          setIsLinkToolPickerOpen(true);
                        }}
                        placeholder="Search existing tools"
                        type="search"
                        value={selectedLinkTool ? displayToolName(selectedLinkTool.name) : linkToolSearchQuery}
                      />
                    </div>
                    {isLinkToolPickerOpen ? (
                      <div className="link-tool-search-results">
                        {filteredLinkToolOptions.length > 0 ? (
                          filteredLinkToolOptions.slice(0, 6).map((tool) => (
                            <button
                              className={linkToolId === tool.id ? "link-tool-result is-selected" : "link-tool-result"}
                              key={tool.id}
                              onClick={() => {
                                setLinkToolId(tool.id);
                                setLinkToolSearchQuery(tool.name);
                                setIsLinkToolPickerOpen(false);
                              }}
                              type="button"
                            >
                              <span className="tool-avatar" style={{ background: tool.logoBg }}>{toolInitials(tool.name)}</span>
                              <span>{displayToolName(tool.name)}</span>
                            </button>
                          ))
                        ) : (
                          <span className="link-tool-empty">No existing tools found</span>
                        )}
                        <button
                          className="link-tool-result link-tool-create-row"
                          onClick={() => {
                            closeLinkToolModal();
                            openAddToolModal();
                          }}
                          type="button"
                        >
                          <span>
                            Can&apos;t find it? <span className="inline-accent-text">+ Create new tool</span>
                          </span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}
                {selectedLinkTool?.accounts.length ? (
                  <small className="field-feedback neutral">
                    Already linked to: {selectedLinkTool.accounts.join(", ")}
                  </small>
                ) : null}
              </label>
              <div className="link-account-blocks">
                {linkToolAccountBlocks.map((block, blockIndex) => {
                  const otherSelectedAccountLabels = linkToolAccountBlocks
                    .filter((otherBlock) => otherBlock.id !== block.id)
                    .map((otherBlock) => otherBlock.accountLabel)
                    .filter(Boolean);
                  const accountOptionsForBlock = orderedAccountOptions.filter(
                    (accountOption) =>
                      accountOption.value === block.accountLabel ||
                      (!selectedLinkTool?.accounts.includes(accountOption.value) &&
                        !otherSelectedAccountLabels.includes(accountOption.value)),
                  );
                  const isAlreadyLinked = Boolean(block.accountLabel && selectedLinkTool?.accounts.includes(block.accountLabel));
                  const isDuplicateInSubmission = Boolean(
                    block.accountLabel &&
                    linkToolAccountBlocks.some(
                      (otherBlock, otherIndex) => otherIndex !== blockIndex && otherBlock.accountLabel === block.accountLabel,
                    ),
                  );

                  return (
                    <div className="link-account-block" key={block.id}>
                      <div className="link-account-block-head">
                        <span>Account {blockIndex + 1}</span>
                        {linkToolAccountBlocks.length > 1 ? (
                          <button
                            aria-label={`Remove account ${blockIndex + 1}`}
                            className="row-icon-action linked-remove-action"
                            onClick={() =>
                              setLinkToolAccountBlocks((currentBlocks) =>
                                currentBlocks.filter((currentBlock) => currentBlock.id !== block.id),
                              )
                            }
                            type="button"
                          >
                            <svg aria-hidden="true" viewBox="0 0 24 24">
                              <path d="m6 6 12 12" />
                              <path d="m18 6-12 12" />
                            </svg>
                          </button>
                        ) : null}
                      </div>
                      <div className="link-account-row">
                        <div className="form-field link-account-field">
                          {renderDropdown({
                            className: "modal-dropdown",
                            id: `link-tool-account-${block.id}`,
                            onChange: (nextAccountLabel) =>
                              setLinkToolAccountBlocks((currentBlocks) =>
                                currentBlocks.map((currentBlock) =>
                                  currentBlock.id === block.id
                                    ? { ...currentBlock, accountLabel: nextAccountLabel }
                                    : currentBlock,
                                ),
                              ),
                            options: accountOptionsForBlock.length > 0
                              ? [
                                  { disabled: true, label: "No account linked yet", value: "" },
                                  ...accountOptionsForBlock,
                                ]
                              : [{ disabled: true, label: "No accounts available", value: "" }],
                            placeholder: "Select account",
                            value: block.accountLabel,
                          })}
                          {isAlreadyLinked ? (
                            <small className="field-feedback error">Already linked to this account</small>
                          ) : isDuplicateInSubmission ? (
                            <small className="field-feedback error">This account is already selected above</small>
                          ) : null}
                        </div>
                        <div className="form-field link-plan-field">
                          {blockIndex === 0 ? <span>Plan</span> : null}
                          {renderPlanSelector(
                            block.plan,
                            (nextPlan) =>
                              setLinkToolAccountBlocks((currentBlocks) =>
                                currentBlocks.map((currentBlock) =>
                                  currentBlock.id === block.id
                                    ? { ...currentBlock, plan: nextPlan }
                                    : currentBlock,
                                ),
                              ),
                            selectedLinkTool,
                          )}
                        </div>
                      </div>
                      {block.plan === "Active" ? (
                        <label className="form-field">
                          <span>Plan Name</span>
                          <input
                            onChange={(event) =>
                              setLinkToolAccountBlocks((currentBlocks) =>
                                currentBlocks.map((currentBlock) =>
                                  currentBlock.id === block.id
                                    ? { ...currentBlock, planName: formatNickname(event.target.value) }
                                    : currentBlock,
                                ),
                              )
                            }
                            placeholder="Basic, Plus, Pro, Team, Business, Enterprise, Pay as you go..."
                            type="text"
                            value={block.planName}
                          />
                        </label>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              {remainingLinkAccountOptions.length > 0 ? (
                <button
                  className="inline-text-link link-add-account-block"
                  onClick={() =>
                    setLinkToolAccountBlocks((currentBlocks) => [
                      ...currentBlocks,
                      {
                        accountLabel: "",
                        id: `link-account-${Date.now().toString(36)}-${currentBlocks.length + 1}`,
                        plan: "Free Tier",
                        planName: "",
                      },
                    ])
                  }
                  type="button"
                >
                  + Add another account
                </button>
              ) : null}
              <div className="welcome-modal-actions">
                <button
                  className="btn-sm btn-sm-primary"
                  disabled={isLinkToolSubmitBlocked}
                  type="submit"
                >
                  Save
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {managingLink && managedTool ? (
        <div className="welcome-modal-overlay" role="presentation">
          <section aria-labelledby="manage-account-modal-title" aria-modal="true" className="welcome-modal" role="dialog">
            <button
              aria-label="Close manage account modal"
              className="modal-close-button"
              onClick={closeManageAccountModal}
              type="button"
            >
              x
            </button>
            <h2 id="manage-account-modal-title">Edit Link</h2>
            <p>{managedTool.name}</p>
            <form className="modal-form" onSubmit={saveManagedAccount}>
              <label className="form-field manage-account-field">
                <span>Account</span>
                {renderDropdown({
                  className: "modal-dropdown",
                  id: "manage-account-switch",
                  onChange: setManagedAccountLabel,
                  options: managedAccountOptions,
                  placeholder: "Select account",
                  value: managedAccountLabel,
                })}
                {isDuplicateManagedAccount ? (
                  <small className="field-feedback error">Already linked to this account</small>
                ) : null}
              </label>

              <label className="form-field">
                <span>Plan</span>
                {renderDropdown({
                  className: "modal-dropdown",
                  id: "manage-plan",
                  onChange: (nextPlan) => setManagedPlan(nextPlan as ToolStatus),
                  options: planStatusOptions,
                  value: managedPlan,
                })}
              </label>

              {managedPlan === "Active" ? (
                <div className="manage-billing-block">
                  <label className="form-field">
                    <span>Plan name</span>
                    <input
                      onChange={(event) => setManagedPlanName(event.target.value)}
                      placeholder="Basic, Plus, Pro, Team, Business, Enterprise, Pay as you go..."
                      type="text"
                      value={managedPlanName}
                    />
                  </label>
                  <label className="form-field">
                    <span>Billing type</span>
                    {renderMultiSelectDropdown({
                      className: "modal-dropdown",
                      id: "manage-billing-type",
                      onChange: (nextBillingTypes) => {
                        setManagedBillingType(nextBillingTypes.join(", "));
                        setManagedBillingAmounts((currentAmounts) =>
                          nextBillingTypes.map((billingType) =>
                            currentAmounts.find((entry) => entry.billingType === billingType) ?? {
                              amount: "",
                              billingType,
                              currency: defaultCurrency,
                            },
                          ),
                        );
                      },
                      options: billingTypeOptions,
                      placeholder: "Select billing type",
                      values: managedBillingType ? managedBillingType.split(", ") : [],
                    })}
                  </label>
                  {managedBillingAmounts.map((billingAmount) => (
                    <label className="form-field" key={billingAmount.billingType}>
                      <span>Amount - {billingAmount.billingType}</span>
                      <span className="billing-amount-field modal-amount-field managed-amount-field">
                        {renderDropdown({
                          ariaLabel: `${billingAmount.billingType} currency`,
                          className: "billing-currency-dropdown",
                          id: `manage-currency-${billingAmount.billingType}`,
                          onChange: (nextCurrency) => setManagedBillingAmounts((currentAmounts) =>
                            currentAmounts.map((entry) => entry.billingType === billingAmount.billingType
                              ? { ...entry, currency: normaliseCurrency(nextCurrency) }
                              : entry)),
                          options: currencyOptions,
                          value: billingAmount.currency,
                        })}
                        <input
                          inputMode="decimal"
                          onChange={(event) => setManagedBillingAmounts((currentAmounts) =>
                            currentAmounts.map((entry) => entry.billingType === billingAmount.billingType
                              ? { ...entry, amount: event.target.value }
                              : entry))}
                          placeholder="0.00"
                          type="number"
                          value={billingAmount.amount}
                        />
                      </span>
                    </label>
                  ))}
                  <label className="form-field">
                    <span>Next charge</span>
                    <input
                      onChange={(event) => setManagedNextChargeDate(event.target.value)}
                      type="date"
                      value={managedNextChargeDate}
                    />
                  </label>
                </div>
              ) : null}

              {managedPlan === "Trial" ? (
                <div className="manage-billing-block">
                  <label className="form-field">
                    <span>Trial expiry date</span>
                    <input
                      onChange={(event) => setManagedTrialExpiryDate(event.target.value)}
                      type="date"
                      value={managedTrialExpiryDate}
                    />
                  </label>
                </div>
              ) : null}

              <label className="form-field">
                <span>Status</span>
                {renderDropdown({
                  className: "modal-dropdown",
                  id: "manage-status",
                  onChange: (nextStatus) => setManagedStatus(nextStatus as ManageStatus),
                  options: (["Active", "On a Break", "Goodbye"] as ManageStatus[]).map((status) => ({
                    label: status,
                    value: status,
                  })),
                  value: managedStatus,
                })}
              </label>

              <div className="welcome-modal-actions manage-modal-actions">
                <button
                  className="quiet-danger-link"
                  onClick={() => {
                    removeLinkedAccount(managingLink.toolId, managingLink.accountLabel);
                    closeManageAccountModal();
                  }}
                  type="button"
                >
                  Unlink this account
                </button>
                <button className="btn-sm btn-sm-primary" disabled={isDuplicateManagedAccount} type="submit">
                  Save
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {editingBillingLink ? (
        <div className="welcome-modal-overlay" role="presentation">
          <section aria-labelledby="billing-edit-modal-title" aria-modal="true" className="welcome-modal" role="dialog">
            <button
              aria-label="Close billing modal"
              className="modal-close-button"
              onClick={closeBillingEditModal}
              type="button"
            >
              x
            </button>
            <h2 id="billing-edit-modal-title">Edit Billing</h2>
            <form className="modal-form" onSubmit={saveBillingDetails}>
              <label className="form-field">
                <span>Plan name</span>
                <input
                  onChange={(event) => setBillingPlanName(formatNickname(event.target.value))}
                  placeholder="Basic, Plus, Pro, Team, Business, Enterprise, Pay as you go..."
                  type="text"
                  value={billingPlanName}
                />
              </label>
              <label className="form-field">
                <span>Billing type</span>
                {renderMultiSelectDropdown({
                  className: "modal-dropdown",
                  id: "billing-edit-type",
                  onChange: (nextBillingTypes) => setBillingBillingType(nextBillingTypes.join(", ")),
                  options: billingTypeOptions,
                  placeholder: "Select billing type",
                  values: billingBillingType ? billingBillingType.split(", ") : [],
                })}
              </label>
              <label className="form-field">
                <span>Amount</span>
                <span className="billing-amount-field modal-amount-field">
                  {renderDropdown({
                    ariaLabel: "Billing currency",
                    className: "billing-currency-dropdown",
                    id: "billing-edit-currency",
                    onChange: (nextCurrency) => setBillingCurrency(normaliseCurrency(nextCurrency)),
                    options: currencyOptions,
                    value: billingCurrency,
                  })}
                  <input
                    onChange={(event) => setBillingAmount(event.target.value)}
                    placeholder="29"
                    type="text"
                    value={billingAmount}
                  />
                </span>
              </label>
              <label className="form-field">
                <span>Next charge</span>
                <span className="billing-date-picker billing-date-picker-modal">
                  <span>{formatBillingDate(billingNextChargeDate)}</span>
                  <svg aria-hidden="true" viewBox="0 0 24 24">
                    <rect x="4" y="5.5" width="16" height="14" rx="2" />
                    <path d="M8 3.5v4M16 3.5v4M4 9.5h16" />
                  </svg>
                  <input
                    aria-label="Next charge date"
                    onChange={(event) => setBillingNextChargeDate(event.target.value)}
                    type="date"
                    value={billingNextChargeDate}
                  />
                </span>
              </label>
              <div className="welcome-modal-actions">
                <button className="btn-sm btn-sm-primary" type="submit">
                  Save
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {editingProvider && (
        <div className="welcome-modal-overlay" role="presentation">
          <section aria-labelledby="edit-provider-modal-title" aria-modal="true" className="welcome-modal" role="dialog">
            <button
              aria-label="Close edit provider modal"
              className="modal-close-button"
              onClick={() => {
                setEditingProvider(null);
                setProviderName("");
              }}
              type="button"
            >
              x
            </button>
            <button
              aria-label="Delete provider"
              className="modal-trash-button"
              onClick={() => {
                setDeletingProvider(editingProvider);
                setEditingProvider(null);
              }}
              type="button"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <TrashIconPaths />
              </svg>
            </button>
            <h2 id="edit-provider-modal-title">Edit Provider</h2>
            <form className="modal-form" onSubmit={saveProviderName}>
              <label className="form-field">
                <span>Provider Name</span>
                <input
                  onChange={(event) => setProviderName(formatNickname(event.target.value))}
                  placeholder="Provider name"
                  type="text"
                  value={providerName}
                />
              </label>
              <div className="welcome-modal-actions">
                <button className="btn-sm btn-sm-primary" type="submit">
                  Save changes
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {deletingAccount && (
        <div className="welcome-modal-overlay" role="presentation">
          <section
            aria-labelledby="delete-account-modal-title"
            aria-modal="true"
            className="welcome-modal delete-account-modal"
            role="dialog"
          >
            <button
              aria-label="Close delete account modal"
              className="modal-close-button"
              onClick={() => {
                setDeletingAccount(null);
                setEditingAccount(null);
              }}
              type="button"
            >
              x
            </button>
            <div className="delete-account-icon">
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <TrashIconPaths />
              </svg>
            </div>
            <h2 id="delete-account-modal-title">Delete Account?</h2>
            <p>
              This action is irreversible. All AI tools under <strong>{deletingAccount.label}</strong> will be
              permanently removed.
            </p>
            {accountDataError ? (
              <div className="data-state-message error" role="alert">
                {accountDataError}
              </div>
            ) : null}
            <div className="welcome-modal-actions">
              <button
                className="btn-sm btn-sm-ghost"
                onClick={() => {
                  setDeletingAccount(null);
                  setEditingAccount(null);
                }}
                type="button"
              >
                Cancel
              </button>
              <button
                className="btn-sm btn-sm-danger"
                disabled={isSavingAccount}
                onClick={async () => {
                  setAccountDataError("");
                  setIsSavingAccount(true);
                  try {
                    if (shouldUseSupabase && deletingAccount.id) {
                      await deleteAccountRecord(deletingAccount.id);
                    }
                    setAccountList((currentAccounts) =>
                      currentAccounts.filter((account) =>
                        deletingAccount.id ? account.id !== deletingAccount.id : account.login !== deletingAccount.login,
                      ),
                    );
                    setDeletingAccount(null);
                    setEditingAccount(null);
                  } catch (error) {
                    const message = error instanceof Error ? error.message : "Could not delete account.";
                    setAccountDataError(message);
                  } finally {
                    setIsSavingAccount(false);
                  }
                }}
                type="button"
              >
                {isSavingAccount ? "Deleting..." : "Delete Account"}
              </button>
            </div>
          </section>
        </div>
      )}

      {deletingProvider && (
        <div className="welcome-modal-overlay" role="presentation">
          <section
            aria-labelledby="delete-provider-modal-title"
            aria-modal="true"
            className="welcome-modal delete-account-modal"
            role="dialog"
          >
            <button
              aria-label="Close delete provider modal"
              className="modal-close-button"
              onClick={() => setDeletingProvider(null)}
              type="button"
            >
              x
            </button>
            <div className="delete-account-icon">
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <TrashIconPaths />
              </svg>
            </div>
            <h2 id="delete-provider-modal-title">Delete Provider?</h2>
            <p>
              This action is irreversible. Provider <strong>{deletingProvider}</strong> will be permanently removed.
            </p>
            <div className="welcome-modal-actions">
              <button className="btn-sm btn-sm-ghost" onClick={() => setDeletingProvider(null)} type="button">
                Cancel
              </button>
              <button className="btn-sm btn-sm-danger" onClick={deleteProvider} type="button">
                Delete Provider
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<main className="app-shell" />}>
      <DashboardContent />
    </Suspense>
  );
}

