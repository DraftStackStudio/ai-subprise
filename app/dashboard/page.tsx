"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import toolCustomizationsData from "@/config/toolCustomizations.json";
import toolPlanTiersData from "@/config/tool-plan-tiers.json";
import toolboxPresetsData from "@/config/toolboxPresets.json";
import BillingHistoryPanel from "@/components/BillingHistoryPanel";
import BillingView from "@/components/BillingView";
import BulkToolActions from "@/components/BulkToolActions";
import AIToolboxView from "@/components/AIToolboxView";
import AccountModal, { type AccountFormValues } from "@/components/AccountModal";
import AIToolModal from "@/components/AIToolModal";
import CategorySetupModals, { type RoleOption } from "@/components/CategorySetupModals";
import DashboardConfirmationModals from "@/components/DashboardConfirmationModals";
import DashboardPageHeader from "@/components/DashboardPageHeader";
import DashboardSidebar from "@/components/DashboardSidebar";
import DashboardSummaryView from "@/components/DashboardSummaryView";
import DeleteAccountModal from "@/components/DeleteAccountModal";
import {
  DropdownControl,
  MultiSelectDropdownControl,
  type DropdownControlProps,
  type DropdownOption,
  type MultiSelectDropdownControlProps,
} from "@/components/DropdownControls";
import EditCategoryModal from "@/components/EditCategoryModal";
import LinkAIToolModal from "@/components/LinkAIToolModal";
import ListPageToolbar from "@/components/ListPageToolbar";
import LoginsView from "@/components/LoginsView";
import PresetToolPickerModal from "@/components/PresetToolPickerModal";
import ProviderManagementModals from "@/components/ProviderManagementModals";
import ProvidersView from "@/components/ProvidersView";
import RecentlyDeletedPanel from "@/components/RecentlyDeletedPanel";
import ResetAIToolsModals from "@/components/ResetAIToolsModals";
import SettingsView from "@/components/SettingsView";
import ToolDetailModal from "@/components/ToolDetailModal";
import ToolCategoryGroup from "@/components/ToolCategoryGroup";
import ToolRowRenderer, {
  BillingAccountCell,
  BillingToolNameCell,
  LinkedAccountCell,
  PricingUrlIcon,
  ToolNameCell,
} from "@/components/ToolRowRenderer";
import {
  toggleBillingTypeSelection,
  validateBillingTypeSelection,
} from "@/config/billingTypeRules";
import {
  demoAccounts,
  demoManualBillingHistory,
  demoToolLinks,
  demoWorkspaceFixtureVersion,
} from "@/config/demoWorkspaceData";
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
  billingHistoryDisplayDate,
  createPendingResolutionEntry,
  pendingResolutionOptions,
  updateGeneratedBillingHistoryNote,
  updateManualBillingHistoryNote,
} from "@/lib/billingHistory";
import type {
  BillingHistoryEntry,
  BillingHistoryEvent,
  BillingHistorySection,
  BillingHistoryTarget,
} from "@/types/billingHistory";
import type {
  BillingAmount,
  ManageStatus,
  ToolDetailAccountDraft,
  ToolStatus,
} from "@/types/toolDetail";
import type { LinkToolAccountBlock } from "@/types/linkTool";
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
type ToolSortRange = "All" | "Category" | "A-G" | "H-N" | "O-S" | "T-Z";
type LinkedPlanFilter = "All" | "Paid" | "Trial" | "Free";
const toolboxSidebarClusterIds = new Set(["everyday", "create", "work", "automate", "build", "business"]);
type ToolboxPresetCategory = {
  description: string;
  id: string;
  label: string;
  pendingTools?: string[];
  subgroups?: Array<{ label: string; tools: string[] }>;
  tools?: string[];
};
type ToolboxPresetConfig = {
  categories: ToolboxPresetCategory[];
  clusters: Array<{ categories: string[]; id: string; label: string }>;
  excludedTools: Array<{ name: string; reason: string }>;
  templates: Record<string, { categories: string[]; label: RoleOption }>;
};
type PlanKey = "free" | "trial" | "paid";
type ToolPlanTierOverride = {
  aliases: string[];
  domain: string;
  icon: string;
  not_paid_label: string;
  reason: string;
  supported_tiers: PlanKey[];
  tool_name: string;
};
type ToolPlanTierConfig = {
  default_tiers: PlanKey[];
  domain_matching_rule: string;
  match_priority: Array<"domain" | "aliases" | "tool_name">;
  not_subscribed_label: string;
  overrides: Record<string, ToolPlanTierOverride>;
};
type ArchivedStatusKey = "active" | "trial" | "free" | "paused" | "watchlist" | "cancelled";
type ToolCustomization = {
  displayInitials?: string;
  preserveNameCase?: boolean;
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
type BillingType = string;
type ToolAccountDetail = {
  amount: string;
  billingAmounts?: BillingAmount[];
  billingType: BillingType;
  currency: string;
  lastTopUpDate: string;
  nextChargeDate: string;
  planName: string;
  status: ManageStatus;
  trialExpiryDate: string;
};

const navItems: Array<{ id: Section; icon: string; label: string; badge?: number }> = [
  { id: "dashboard", icon: "grid", label: "Dashboard" },
  { id: "account", icon: "user", label: "Logins", badge: 3 },
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
const toolPlanTiers = toolPlanTiersData as ToolPlanTierConfig;
const toolboxPresets = toolboxPresetsData as ToolboxPresetConfig;

function billingAmountId(id?: string) {
  return id || crypto.randomUUID();
}

const defaultProviders = ["Gmail", "iCloud", "Outlook", "Yahoo", "Github"];
const customProviderOption = "+ new provider";
const defaultToolCategories = toolboxPresets.categories.map((category) => category.label);
const presetCategoryById = new Map(toolboxPresets.categories.map((category) => [category.id, category]));
const presetCategoryByLabel = new Map(toolboxPresets.categories.map((category) => [category.label, category]));
const categoryDescriptions: Record<string, string> = Object.fromEntries(
  toolboxPresets.categories.map((category) => [category.label, category.description]),
);
const customCategoryOption = "+ new category";
const roleOptions = Object.values(toolboxPresets.templates).map((template) => template.label);
const roleCategoryMap = Object.fromEntries(
  Object.values(toolboxPresets.templates).map((template) => [
    template.label,
    template.categories
      .map((categoryId) => presetCategoryById.get(categoryId)?.label)
      .filter((category): category is string => Boolean(category)),
  ]),
) as Record<RoleOption, string[]>;
const legacyCategoryMap: Record<string, string> = {
  Audio: "Visual & Audio",
  "Chat & AI": "AI Assistant",
  "Chat & Reasoning": "AI Assistant",
  "Image Gen": "Visual & Audio",
  "Image Generation": "Visual & Audio",
  LLM: "AI Assistant",
  "Media Generation": "Visual & Audio",
  Other: "Niche",
  Coding: "Coding & Dev",
  "Video Gen": "Visual & Audio",
  "Video Generation": "Visual & Audio",
};
const presetToolCategoryByName = new Map(
  toolboxPresets.categories.flatMap((category) => {
    const names = category.subgroups
      ? category.subgroups.flatMap((subgroup) => subgroup.tools)
      : (category.tools ?? []);
    return names.map((name) => [name.trim().toLowerCase(), category.label] as const);
  }),
);
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
const demoAccountsStorageKey = "ai-subprise-demo-logins-v1";
const demoBillingHistoryStorageKey = "ai-subprise-demo-billing-history-v1";
const demoFixtureVersionStorageKey = "ai-subprise-demo-workspace-fixture-version";
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
  const normaliseEntry = (entry: string) => {
    const trimmedEntry = entry.trim();
    if (trimmedEntry === "Annual" || trimmedEntry === "Yearly") return "Yearly";
    if (trimmedEntry === "Top-up Credit" || trimmedEntry === "Top-up credit" || trimmedEntry === "Top-up") return "Top-up";
    if (trimmedEntry === "One-time credit" || trimmedEntry === "One-time") return "One-time";
    if (trimmedEntry === "Lifetime") return "Lifetime";
    return "Monthly";
  };

  const entries = value
    ? value.split(",").map(normaliseEntry)
    : ["Monthly"];
  return validateBillingTypeSelection(entries).join(", ") || "Monthly";
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
  if (status === "Paid") return "Paid";
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
    year: "numeric",
  });
}

function formatBillingDate(value: string) {
  if (!value) return "Select date";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Select date";
  return date
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    .replace(/[.,]\s*$/, "");
}

function DateFieldControl({
  ariaLabel,
  className = "",
  onChange,
  value,
}: {
  ariaLabel: string;
  className?: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function openDatePicker() {
    const input = inputRef.current;
    if (!input) return;

    input.focus({ preventScroll: true });
    try {
      if (typeof input.showPicker === "function") {
        input.showPicker();
      } else {
        input.click();
      }
    } catch {
      input.click();
    }
  }

  return (
    <span
      aria-label={ariaLabel}
      className={`modal-date-display-control${className ? ` ${className}` : ""}`}
      onClick={(event) => {
        if (event.target !== inputRef.current) openDatePicker();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openDatePicker();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <span>{formatBillingDate(value)}</span>
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <rect x="4" y="5.5" width="16" height="14" rx="2" />
        <path d="M8 3.5v4M16 3.5v4M4 9.5h16" />
      </svg>
      <input
        aria-hidden="true"
        onChange={(event) => onChange(event.target.value)}
        ref={inputRef}
        tabIndex={-1}
        type="date"
        value={value}
      />
    </span>
  );
}

function billingMonthLabel(value: string) {
  if (!value) return "No date";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "No date";
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
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

function normaliseToolHostname(value?: string) {
  const trimmedValue = value?.trim();
  if (!trimmedValue) return "";

  try {
    const parsedUrl = new URL(/^https?:\/\//i.test(trimmedValue) ? trimmedValue : `https://${trimmedValue}`);
    return parsedUrl.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function toolPlanOverrideFor(tool?: string | Pick<ToolItem, "name" | "pricingUrl">) {
  if (!tool) return undefined;
  const toolName = typeof tool === "string" ? tool : tool.name;
  const toolHostname = typeof tool === "string" ? "" : normaliseToolHostname(tool.pricingUrl);
  const normalisedName = toolName.trim().toLowerCase();
  const overrides = Object.values(toolPlanTiers.overrides);

  if (toolHostname) {
    const domainMatch = overrides.find(
      (override) => normaliseToolHostname(override.domain) === toolHostname,
    );
    if (domainMatch) return domainMatch;
  }

  const aliasMatch = overrides.find((override) =>
    override.aliases.some((alias) => alias.trim().toLowerCase() === normalisedName),
  );
  if (aliasMatch) return aliasMatch;

  return overrides.find(
    (override) => override.tool_name.trim().toLowerCase() === normalisedName,
  );
}

function supportedPlanKeysForTool(tool?: string | Pick<ToolItem, "name" | "pricingUrl">): PlanKey[] {
  if (!tool) return [...toolPlanTiers.default_tiers];
  return [...(toolPlanOverrideFor(tool)?.supported_tiers ?? toolPlanTiers.default_tiers)];
}

function notPaidPlanLabelForTool(tool?: string | Pick<ToolItem, "name" | "pricingUrl">) {
  if (!tool) return "Free";
  return toolPlanOverrideFor(tool)?.not_paid_label ?? "Free";
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

function categoryForTool(name: string, currentCategory: string) {
  return presetToolCategoryByName.get(name.trim().toLowerCase()) ?? normaliseToolCategory(currentCategory);
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
    category: categoryForTool(record.name, record.category),
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
    category: categoryForTool(item.name, item.category),
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
  const [activeToolboxClusterId, setActiveToolboxClusterId] = useState("everyday");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isToolsNavOpen, setIsToolsNavOpen] = useState(true);
  const [showCreateAccountModal, setShowCreateAccountModal] = useState(false);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [showAddToolModal, setShowAddToolModal] = useState(false);
  const [showPresetToolPicker, setShowPresetToolPicker] = useState(false);
  const [showPresetSelectionWarning, setShowPresetSelectionWarning] = useState(false);
  const [showCategorySelectionWarning, setShowCategorySelectionWarning] = useState(false);
  const [showAllPresetCategories, setShowAllPresetCategories] = useState(false);
  const [expandedPresetCategories, setExpandedPresetCategories] = useState<string[]>([]);
  const [selectedPresetToolNames, setSelectedPresetToolNames] = useState<string[]>([]);
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
    action: "unarchive" | "unwatchlist";
    tool: ToolItem;
  } | null>(null);
  const [watchlistMoveTool, setWatchlistMoveTool] = useState<ToolItem | null>(null);
  const [expandedToolIds, setExpandedToolIds] = useState<string[]>([]);
  const [isLinkToolLocked, setIsLinkToolLocked] = useState(false);
  const [linkToolActivateToolId, setLinkToolActivateToolId] = useState("");
  const [managingLink, setManagingLink] = useState<{ accountLabel: string; toolId: string } | null>(null);
  const [toolDetailDrafts, setToolDetailDrafts] = useState<Record<string, ToolDetailAccountDraft>>({});
  const [originalToolDetailDrafts, setOriginalToolDetailDrafts] = useState<Record<string, ToolDetailAccountDraft>>({});
  const [managedAccountLabel, setManagedAccountLabel] = useState("");
  const [managedPlan, setManagedPlan] = useState<ToolStatus>("Free Tier");
  const [managedPlanName, setManagedPlanName] = useState("");
  const [managedBillingType, setManagedBillingType] = useState<BillingType>("Monthly");
  const [managedBillingAmounts, setManagedBillingAmounts] = useState<BillingAmount[]>([
    { amount: "", billingType: "Monthly", currency: "USD", id: billingAmountId() },
  ]);
  const [managedNextChargeDate, setManagedNextChargeDate] = useState("");
  const [managedTrialExpiryDate, setManagedTrialExpiryDate] = useState("");
  const [managedStatus, setManagedStatus] = useState<ManageStatus>("Active");
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
  const [settingsTab, setSettingsTab] = useState<"profile" | "preferences">("profile");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [toolResetArchives, setToolResetArchives] = useState<ToolResetArchive[]>([]);
  const [hasLoadedStoredTools, setHasLoadedStoredTools] = useState(false);
  const [customProviders, setCustomProviders] = useState<string[]>([]);
  const [customToolCategories, setCustomToolCategories] = useState<string[]>([]);
  const [workspaceCategories, setWorkspaceCategories] = useState<string[]>([]);
  const [providerName, setProviderName] = useState("");
  const [isCustomCategoryMode, setIsCustomCategoryMode] = useState(false);
  const [toolName, setToolName] = useState("");
  const [toolCategory, setToolCategory] = useState("");
  const [toolUrl, setToolUrl] = useState("");
  const [linkToolId, setLinkToolId] = useState("");
  const [linkToolAccountBlocks, setLinkToolAccountBlocks] = useState<LinkToolAccountBlock[]>([
    { accountLabel: "", billingType: "Monthly", id: "link-account-1", lastTopUpDate: "", nextChargeDate: "", plan: "Free Tier", planName: "", trialExpiryDate: "" },
  ]);
  const [linkToolSearchQuery, setLinkToolSearchQuery] = useState("");
  const [isLinkToolPickerOpen, setIsLinkToolPickerOpen] = useState(false);
  const [hasSubmittedLinkToolForm, setHasSubmittedLinkToolForm] = useState(false);
  const [toolboxSearch, setToolboxSearch] = useState("");
  const [linkedSearch, setLinkedSearch] = useState("");
  const [billingSearch, setBillingSearch] = useState("");
  const [watchlistSearch, setWatchlistSearch] = useState("");
  const [favouritesSearch, setFavouritesSearch] = useState("");
  const [archivedSearch, setArchivedSearch] = useState("");
  const [categoryDrafts, setCategoryDrafts] = useState<string[]>([]);
  const [categoryDeleteWarning, setCategoryDeleteWarning] = useState<{
    category: string;
    index: number;
    toolCount: number;
  } | null>(null);
  const [categoryDiscardWarning, setCategoryDiscardWarning] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [restoreToolIds, setRestoreToolIds] = useState<string[]>([]);
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([]);
  const [selectedRecoveryKeys, setSelectedRecoveryKeys] = useState<string[]>([]);
  const [expandedRecoveryIds, setExpandedRecoveryIds] = useState<string[]>([]);
  const [recoverySearch, setRecoverySearch] = useState("");
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [selectedToolSort, setSelectedToolSort] = useState<ToolSortRange>("Category");
  const [linkedPlanFilter, setLinkedPlanFilter] = useState<LinkedPlanFilter>("All");
  const [selectedBillingView, setSelectedBillingView] = useState<"All" | "Month">("All");
  const [billingHistoryTarget, setBillingHistoryTarget] = useState<BillingHistoryTarget | null>(null);
  const [billingHistoryNotes, setBillingHistoryNotes] = useState<Record<string, string>>({});
  const [manualBillingHistory, setManualBillingHistory] = useState<Record<string, BillingHistoryEntry[]>>({});
  const [isPendingActionsExpanded, setIsPendingActionsExpanded] = useState(false);
  const [resolvingPendingActionId, setResolvingPendingActionId] = useState("");
  const [pendingResolutionOutcome, setPendingResolutionOutcome] = useState<BillingHistoryEvent>("Charged");
  const [pendingResolutionDate, setPendingResolutionDate] = useState("");
  const [pendingResolutionConfirmation, setPendingResolutionConfirmation] = useState<{
    entry: BillingHistoryEntry;
    recordKey: string;
  } | null>(null);
  const [hasCustomToolOrder, setHasCustomToolOrder] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleOption>("Creator");
  const [roleQuestionChoice, setRoleQuestionChoice] = useState<RoleOption | "">("");
  const toolNameInputRef = useRef<HTMLInputElement | null>(null);
  const mainContentRef = useRef<HTMLElement | null>(null);
  const accountToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedRoleCategories, setSelectedRoleCategories] = useState<string[]>(roleCategoryMap.Creator);
  const [draggedAccountLogin, setDraggedAccountLogin] = useState<string | null>(null);
  const [draggedToolName, setDraggedToolName] = useState<string | null>(null);
  const [editingToolName, setEditingToolName] = useState<string | null>(null);
  const [editingToolCategoryId, setEditingToolCategoryId] = useState<string | null>(null);
  const [toolNameDraft, setToolNameDraft] = useState("");
  const [hasSubmittedToolForm, setHasSubmittedToolForm] = useState(false);
  const hasConfirmedCategories = workspaceCategories.length > 0;

  const reseedDemoWorkspace = (showConfirmation = true) => {
    if (!isDemoMode) return;

    const demoAccountRecords = demoAccounts.map((account) => ({ ...account })) as Account[];
    const fixtureToolsByName = new Map(
      demoToolLinks.map((fixture) => [fixture.toolName.toLowerCase(), fixture]),
    );
    const matchedTools = toolList.filter((tool) => fixtureToolsByName.has(tool.name.trim().toLowerCase()));
    if (matchedTools.length === 0) return;

    setAccountList(demoAccountRecords);
    setToolList((currentTools) => currentTools.map((tool) => {
      const fixture = fixtureToolsByName.get(tool.name.trim().toLowerCase());
      return fixture ? { ...tool, accounts: fixture.accounts.map((account) => account.accountLabel) } : tool;
    }));

    setToolAccountStatuses((current) => {
      const next = { ...current };
      matchedTools.forEach((tool) => {
        const fixture = fixtureToolsByName.get(tool.name.trim().toLowerCase());
        if (!fixture) return;
        next[tool.id] = fixture.accounts.reduce<Record<string, ToolStatus>>((statuses, account) => {
          statuses[account.accountLabel] = account.plan as ToolStatus;
          return statuses;
        }, {});
      });
      return next;
    });

    setToolAccountPlanNames((current) => {
      const next = { ...current };
      matchedTools.forEach((tool) => {
        const fixture = fixtureToolsByName.get(tool.name.trim().toLowerCase());
        if (!fixture) return;
        next[tool.id] = fixture.accounts.reduce<Record<string, string>>((planNames, account) => {
          planNames[account.accountLabel] = account.planName;
          return planNames;
        }, {});
      });
      return next;
    });

    setToolAccountDetails((current) => {
      const next = { ...current };
      matchedTools.forEach((tool) => {
        const fixture = fixtureToolsByName.get(tool.name.trim().toLowerCase());
        if (!fixture) return;
        next[tool.id] = fixture.accounts.reduce<Record<string, ToolAccountDetail>>((details, account) => {
          details[account.accountLabel] = {
            amount: account.billingAmounts[0]?.amount ?? "",
            billingAmounts: account.billingAmounts.map((amount) => ({ ...amount, id: billingAmountId(amount.id) })),
            billingType: account.billingType,
            currency: account.billingAmounts[0]?.currency ?? "USD",
            lastTopUpDate: "",
            nextChargeDate: account.nextChargeDate,
            planName: account.planName,
            status: account.status as ManageStatus,
            trialExpiryDate: account.trialExpiryDate,
          };
          return details;
        }, {});
      });
      return next;
    });

    const manualTool = matchedTools.find(
      (tool) => tool.name.trim().toLowerCase() === demoManualBillingHistory.toolName.toLowerCase(),
    );
    if (manualTool) {
      const recordKey = `${manualTool.id}::${demoManualBillingHistory.accountLabel}`;
      setManualBillingHistory((current) => ({
        ...current,
        [recordKey]: [{ ...demoManualBillingHistory.entry } as BillingHistoryEntry],
      }));
    }

    try {
      window.localStorage.setItem(demoFixtureVersionStorageKey, demoWorkspaceFixtureVersion);
    } catch {
      // Local storage can be unavailable in private or embedded browser contexts.
    }
    if (showConfirmation) showToast("Demo Logins, Linked, and Billing data reseeded.");
  };

  useEffect(() => {
    if (activeSection === "watchlist" && selectedToolSort !== "Category" && selectedToolSort !== "All") {
      setSelectedToolSort("Category");
    }
  }, [activeSection, selectedToolSort]);

  const renderDropdown = (props: Omit<DropdownControlProps, "isOpen" | "onOpenChange">) => (
    <DropdownControl
      {...props}
      isOpen={openDropdownId === props.id}
      onOpenChange={setOpenDropdownId}
    />
  );

  const renderMultiSelectDropdown = (
    props: Omit<MultiSelectDropdownControlProps, "isOpen" | "onOpenChange">,
  ) => (
    <MultiSelectDropdownControl
      {...props}
      isOpen={openDropdownId === props.id}
      onOpenChange={setOpenDropdownId}
    />
  );

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
      const storedDemoAccounts = window.localStorage.getItem(demoAccountsStorageKey);
      const storedDemoBillingHistory = window.localStorage.getItem(demoBillingHistoryStorageKey);
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
                  billingAmounts: detail.billingAmounts?.length
                    ? detail.billingAmounts.map((entry) => ({
                        amount: entry.amount ?? "",
                        billingType: normaliseBillingType(entry.billingType),
                        currency: normaliseCurrency(entry.currency),
                        id: billingAmountId(entry.id),
                      }))
                    : normaliseBillingType(detail.billingType ?? "Monthly")
                        .split(", ")
                        .filter(Boolean)
                        .map((billingType, index) => ({
                          amount: index === 0 ? detail.amount ?? "" : "",
                          billingType,
                          currency: normaliseCurrency(detail.currency),
                          id: billingAmountId(),
                        })),
                  billingType: normaliseBillingType(detail.billingType ?? "Monthly"),
                  currency: normaliseCurrency(detail.currency),
                  lastTopUpDate: detail.lastTopUpDate ?? "",
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
      if (isDemoMode) {
        if (storedDemoAccounts) {
          const parsedAccounts = JSON.parse(storedDemoAccounts);
          setAccountList(Array.isArray(parsedAccounts) ? parsedAccounts as Account[] : demoAccounts.map((account) => ({ ...account })) as Account[]);
        } else {
          setAccountList(demoAccounts.map((account) => ({ ...account })) as Account[]);
        }
        if (storedDemoBillingHistory) {
          setManualBillingHistory(JSON.parse(storedDemoBillingHistory));
        }
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
  }, [isDemoMode]);

  useEffect(() => {
    if (!isDemoMode || !hasLoadedStoredTools || toolList.length === 0) return;

    let storedVersion = "";
    try {
      storedVersion = window.localStorage.getItem(demoFixtureVersionStorageKey) ?? "";
    } catch {
      storedVersion = "";
    }
    if (storedVersion !== demoWorkspaceFixtureVersion) reseedDemoWorkspace(false);
  }, [hasLoadedStoredTools, isDemoMode, toolList]);

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
              billingAmounts: normaliseBillingType(detail.billingType).split(", ").filter(Boolean).map((billingType, index) => ({
                amount: index === 0 ? detail.amount : "",
                billingType,
                currency: normaliseCurrency(detail.currency),
                id: billingAmountId(),
              })),
              billingType: normaliseBillingType(detail.billingType),
              currency: normaliseCurrency(detail.currency),
              lastTopUpDate: detail.lastTopUpDate,
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
    if (!isDemoMode || !hasLoadedStoredTools) return;
    try {
      window.localStorage.setItem(demoAccountsStorageKey, JSON.stringify(accountList));
    } catch {
      // Local storage can be unavailable in private or embedded browser contexts.
    }
  }, [accountList, hasLoadedStoredTools, isDemoMode]);

  useEffect(() => {
    if (!isDemoMode || !hasLoadedStoredTools) return;
    try {
      window.localStorage.setItem(demoBillingHistoryStorageKey, JSON.stringify(manualBillingHistory));
    } catch {
      // Local storage can be unavailable in private or embedded browser contexts.
    }
  }, [hasLoadedStoredTools, isDemoMode, manualBillingHistory]);

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
    setEditingAccount(null);
    setAccountDataError("");
    setShowAddAccountModal(true);
  };

  const openEditAccountModal = (account: Account) => {
    setEditingAccount(account);
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

  const openPresetToolPicker = () => {
    setExpandedPresetCategories([]);
    setShowAllPresetCategories(false);
    setSelectedPresetToolNames(
      toolList
        .map((tool) => tool.name.trim().toLowerCase())
        .filter((toolName) => presetToolCategoryByName.has(toolName)),
    );
    setShowPresetToolPicker(true);
  };

  const handleAddToolClick = () => {
    if (activeSection === "linked") {
      openLinkToolModal();
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
    setCategoryDiscardWarning(false);
    setNewCategoryName("");
    setShowEditCategoryModal(true);
  };

  const hasUnsavedCategoryChanges = () => {
    const savedCategories = workspaceCategories.length > 0 ? workspaceCategories : defaultToolCategories;
    return JSON.stringify(categoryDrafts) !== JSON.stringify(savedCategories);
  };

  const requestCloseEditCategoryModal = () => {
    if (categoryDeleteWarning) {
      setCategoryDeleteWarning(null);
      return;
    }

    if (categoryDiscardWarning) {
      return;
    }

    if (hasUnsavedCategoryChanges()) {
      setCategoryDiscardWarning(true);
      return;
    }

    setShowEditCategoryModal(false);
    setNewCategoryName("");
  };

  const discardCategoryDrafts = () => {
    const savedCategories = workspaceCategories.length > 0 ? workspaceCategories : defaultToolCategories;
    setCategoryDrafts(savedCategories);
    setCategoryDeleteWarning(null);
    setCategoryDiscardWarning(false);
    setNewCategoryName("");
    setShowEditCategoryModal(false);
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
    setCategoryDiscardWarning(false);
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
  };

  const saveEditedCategories = () => {
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
    if (nextCategories.length === 0) {
      setShowCategorySelectionWarning(true);
      return;
    }
    const confirmedCategories = nextCategories;
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
    openPresetToolPicker();
  };

  const saveAccount = async (
    values: AccountFormValues,
    options?: { addAnother?: boolean },
  ): Promise<boolean> => {
    setAccountDataError("");

    const trimmedNickname = values.nickname.trim();
    const trimmedProvider = values.provider.trim();
    const trimmedLogin = values.login.trim();

    const accountDetails: Account = {
      id: editingAccount?.id,
      label: trimmedNickname,
      provider: trimmedProvider,
      login: trimmedLogin,
      tag: values.colourTag,
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
      return false;
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
    showToast(
      editingAccount
        ? "Account updated."
        : options?.addAnother
          ? "Account added. Keep going."
          : "Account added.",
    );

    if (!options?.addAnother || editingAccount) {
      setEditingAccount(null);
      setShowAddAccountModal(false);
    }
    return true;
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

  const togglePresetTool = (presetName: string) => {
    const normalizedName = presetName.trim().toLowerCase();
    setSelectedPresetToolNames((currentNames) =>
      currentNames.includes(normalizedName)
        ? currentNames.filter((name) => name !== normalizedName)
        : [...currentNames, normalizedName],
    );
  };

  const savePresetToolSelection = async () => {
    if (selectedPresetToolNames.length === 0) {
      setShowPresetSelectionWarning(true);
      return;
    }

    const finalSelection = new Set(selectedPresetToolNames);
    const existingPresetTools = toolList.filter((tool) =>
      presetToolCategoryByName.has(tool.name.trim().toLowerCase()),
    );
    const existingPresetNames = new Set(
      existingPresetTools.map((tool) => tool.name.trim().toLowerCase()),
    );
    const toolsToRemove = existingPresetTools.filter(
      (tool) => !finalSelection.has(tool.name.trim().toLowerCase()),
    );
    const toolsToAdd = Array.from(finalSelection)
      .filter((toolName) => !existingPresetNames.has(toolName))
      .map((toolName) => {
        const presetName =
          toolboxPresets.categories
            .flatMap((category) =>
              category.subgroups
                ? category.subgroups.flatMap((subgroup) => subgroup.tools)
                : (category.tools ?? []),
            )
            .find((name) => name.trim().toLowerCase() === toolName) ?? toolName;
        const category = presetToolCategoryByName.get(toolName) ?? "Niche";
        return {
          id: createToolId(presetName),
          name: presetName,
          category,
          status: "Free" as ToolStatus,
          accounts: [],
          billing: "None",
          notes: "",
          favorite: false,
          archived: false,
          pricingUrl: "#",
          logo: toolInitials(presetName),
          logoBg: "#F0F4FF",
        };
      });

    setIsSavingTool(true);
    setToolDataError("");
    try {
      const savedTools = shouldUseSupabase
        ? await Promise.all(
            toolsToAdd.map(async (tool) =>
              toolFromRecord(await createToolRecord(toolToInput(tool), accountList)),
            ),
          )
        : toolsToAdd;

      if (shouldUseSupabase && toolsToRemove.length > 0) {
        await deleteToolRecords(toolsToRemove.map((tool) => tool.id));
      }

      const removedIds = new Set(toolsToRemove.map((tool) => tool.id));
      setToolList((currentTools) => {
        let nextTools = currentTools.filter((tool) => !removedIds.has(tool.id));
        savedTools.forEach((tool) => {
          nextTools = insertToolAlphabetically(nextTools, tool);
        });
        return nextTools;
      });
      setSelectedToolIds((currentIds) => currentIds.filter((id) => !removedIds.has(id)));

      const addedCategories = new Set(toolsToAdd.map((tool) => tool.category));
      if (addedCategories.size > 0) {
        setWorkspaceCategories((currentCategories) => {
          const nextCategories = defaultToolCategories.filter(
            (category) => currentCategories.includes(category) || addedCategories.has(category),
          );
          try {
            window.localStorage.setItem("ai-subprise-workspace-categories", JSON.stringify(nextCategories));
          } catch {
            // Local storage can be unavailable in private or embedded browser contexts.
          }
          return nextCategories;
        });
        setIsToolsNavOpen(true);
      }

      setShowPresetToolPicker(false);
    } catch (error) {
      setToolDataError(error instanceof Error ? error.message : "Could not update AI tools.");
    } finally {
      setIsSavingTool(false);
    }
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
      showToast("Provider updated.");
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

  const confirmDeleteAccount = async () => {
    if (!deletingAccount) return;

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

    if (confirmToolStateChange.action === "unarchive") {
      unarchiveToolIds([confirmToolStateChange.tool.id]);
      showToast(`${confirmToolStateChange.tool.name} is back.`);
    }

    if (confirmToolStateChange.action === "unwatchlist") {
      await toggleToolWatchlist(confirmToolStateChange.tool.id);
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

  const linkedPlanSnapshot = (tool: ToolItem): ToolStatus => {
    const linkedPlans = tool.accounts.map((accountLabel) => relationStatus(tool, accountLabel));
    if (linkedPlans.some((plan) => plan === "Active" || plan === "Paid")) return "Paid";
    if (linkedPlans.includes("Trial")) return "Trial";
    if (linkedPlans.some((plan) => plan === "Free" || plan === "Free Tier")) return "Free";
    return tool.archivedStatus ?? tool.status;
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

  const isPlanAllowedForTool = (tool: ToolItem | undefined, status: ToolStatus | "") => {
    if (!status) return false;
    return supportedPlanKeysForTool(tool).includes(planKeyForStatus(status));
  };

  const planStatusOptionsForTool = (tool?: ToolItem): Array<{ label: string; value: ToolStatus }> => {
    const optionByKey: Record<PlanKey, { label: string; value: ToolStatus }> = {
      paid: { label: "Paid", value: "Active" },
      trial: { label: "Trial", value: "Trial" },
      free: { label: "Free", value: "Free Tier" },
    };
    const supportedPlans = new Set(supportedPlanKeysForTool(tool));
    return (["paid", "trial", "free"] as PlanKey[])
      .filter((planKey) => supportedPlans.has(planKey))
      .map((planKey) => optionByKey[planKey]);
  };

  const renderPlanSelector = (value: ToolStatus | "", onChange: (nextPlan: ToolStatus | "") => void, tool?: ToolItem) => {
    const planOptions = planStatusOptionsForTool(tool).map((plan) => ({
      ...plan,
      key: planKeyForStatus(plan.value),
    }));
    const isPaidOnly = supportedPlanKeysForTool(tool).length === 1 && supportedPlanKeysForTool(tool)[0] === "paid";

    return (
      <div className="plan-selector" role="group" aria-label="Plan">
          {planOptions.map((plan) => {
            return (
              <button
                className={
                  value === plan.value
                    ? `plan-selector-pill plan-${plan.label.toLowerCase()} is-selected`
                    : `plan-selector-pill plan-${plan.label.toLowerCase()}`
                }
                key={plan.value}
                onClick={() => onChange(plan.value)}
                type="button"
              >
                {plan.label}
              </button>
            );
          })}
          {isPaidOnly ? (
            <button
              aria-pressed={!value}
              className={!value
                ? "plan-selector-pill plan-not-subscribed is-selected"
                : "plan-selector-pill plan-not-subscribed"}
              onClick={() => onChange("")}
              type="button"
            >
              {notPaidPlanLabelForTool(tool)}
            </button>
          ) : null}
      </div>
    );
  };

  const defaultLinkPlanForTool = (tool?: ToolItem): ToolStatus | "" => {
    const supportedPlans = supportedPlanKeysForTool(tool);
    if (supportedPlans.length === 1 && supportedPlans[0] === "paid") return "";
    return statusForPlanKey(supportedPlans[0] ?? "free");
  };

  const resetLinkToolBlocks = (tool?: ToolItem) => {
    setLinkToolAccountBlocks([{ accountLabel: "", billingType: "Monthly", id: "link-account-1", lastTopUpDate: "", nextChargeDate: "", plan: defaultLinkPlanForTool(tool), planName: "", trialExpiryDate: "" }]);
    setHasSubmittedLinkToolForm(false);
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
    if (tool?.status === "Considering") {
      showToast("Remove this tool from Watchlist before linking an account.");
      return;
    }
    setLinkToolId(tool?.id ?? "");
    resetLinkToolBlocks(tool);
    setLinkToolSearchQuery(tool?.name ?? "");
    setIsLinkToolPickerOpen(false);
    setOpenDropdownId(null);
    setIsLinkToolLocked(Boolean(tool));
    setLinkToolActivateToolId(options?.activateToolOnSave && tool ? tool.id : "");
    setShowLinkToolModal(true);
  };

  const openManageAccountModal = (tool: ToolItem, accountLabel: string) => {
    setManagingLink({ accountLabel, toolId: tool.id });
    const initialDrafts = tool.accounts.reduce<Record<string, ToolDetailAccountDraft>>((drafts, linkedAccountLabel) => {
        const details = toolAccountDetails[tool.id]?.[linkedAccountLabel];
        const billingType = normaliseBillingType(details?.billingType ?? "Monthly");
        const selectedBillingTypes = billingType.split(", ").filter(Boolean);
        drafts[linkedAccountLabel] = {
          draftId: linkedAccountLabel,
          accountLabel: linkedAccountLabel,
          billingAmounts: details?.billingAmounts?.length
            ? details.billingAmounts
            : selectedBillingTypes.map((selectedBillingType, index) => ({
                amount: index === 0 ? details?.amount ?? "" : "",
                billingType: selectedBillingType,
                currency: normaliseCurrency(details?.currency ?? defaultCurrency),
                id: billingAmountId(),
              })),
          billingType,
          lastTopUpDate: details?.lastTopUpDate ?? "",
          nextChargeDate: details?.nextChargeDate ?? "",
          plan: relationPlanStatusValue(tool, linkedAccountLabel),
          planName: details?.planName ?? toolAccountPlanNames[tool.id]?.[linkedAccountLabel] ?? "",
          status: details?.status ?? "Active",
          trialExpiryDate: details?.trialExpiryDate ?? "",
        };
        return drafts;
      }, {});
    setToolDetailDrafts(initialDrafts);
    setOriginalToolDetailDrafts(initialDrafts);
  };

  const closeManageAccountModal = () => {
    setManagingLink(null);
    setToolDetailDrafts({});
    setOriginalToolDetailDrafts({});
    setManagedAccountLabel("");
    setManagedPlan("Free Tier");
    setManagedPlanName("");
    setManagedBillingType("Monthly");
    setManagedBillingAmounts([{ amount: "", billingType: "Monthly", currency: defaultCurrency, id: billingAmountId() }]);
    setManagedNextChargeDate("");
    setManagedTrialExpiryDate("");
    setManagedStatus("Active");
  };

  const updateToolDetailDraft = (draftId: string, patch: Partial<ToolDetailAccountDraft>) => {
    setToolDetailDrafts((currentDrafts) => ({
      ...currentDrafts,
      [draftId]: { ...currentDrafts[draftId], ...patch },
    }));
  };

  const saveToolDetailAccount = async (
    tool: ToolItem,
    draft: ToolDetailAccountDraft,
    showConfirmation = true,
  ) => {
    if (!draft.accountLabel || !draft.plan) return false;
    const selectedPlan: ToolStatus = draft.plan;
    const validatedBillingType = normaliseBillingType(draft.billingType);
    const validatedBillingTypes = validatedBillingType.split(", ");
    const hasTopUpCredit = validatedBillingTypes.includes("Top-up");
    const hasPrimaryBillingType = validatedBillingTypes.some((billingType) => billingType !== "Top-up");
    const nextDetail: ToolAccountDetail = {
      amount: draft.plan === "Active" ? draft.billingAmounts[0]?.amount.trim() ?? "" : "",
      billingAmounts: draft.plan === "Active"
        ? draft.billingAmounts.filter((entry) => validatedBillingTypes.includes(entry.billingType))
        : [],
      billingType: validatedBillingType,
      currency: normaliseCurrency(draft.billingAmounts[0]?.currency),
      lastTopUpDate: draft.plan === "Active" && hasTopUpCredit ? draft.lastTopUpDate : "",
      nextChargeDate: draft.plan === "Active" && hasPrimaryBillingType ? draft.nextChargeDate : "",
      planName: draft.plan === "Active" ? draft.planName.trim() : "",
      status: draft.status,
      trialExpiryDate: draft.plan === "Trial" ? draft.trialExpiryDate : "",
    };

    setToolAccountStatuses((current) => ({
      ...current,
      [tool.id]: { ...(current[tool.id] ?? {}), [draft.accountLabel]: selectedPlan },
    }));
    setToolAccountPlanNames((current) => ({
      ...current,
      [tool.id]: { ...(current[tool.id] ?? {}), [draft.accountLabel]: nextDetail.planName },
    }));
    setToolAccountDetails((current) => ({
      ...current,
      [tool.id]: { ...(current[tool.id] ?? {}), [draft.accountLabel]: nextDetail },
    }));

    if (shouldUseSupabase) {
      try {
        await updateToolLinkDetails(tool.id, draft.accountLabel, accountList, {
          amount: nextDetail.amount,
          billingType: nextDetail.billingType,
          currency: nextDetail.currency,
          lastTopUpDate: nextDetail.lastTopUpDate,
          nextChargeDate: nextDetail.nextChargeDate,
          plan: draft.plan,
          planName: nextDetail.planName,
          status: nextDetail.status,
          trialExpiryDate: nextDetail.trialExpiryDate,
        });
      } catch (error) {
        setToolDataError(error instanceof Error ? error.message : "Could not update linked account.");
        return false;
      }
    }
    if (showConfirmation) showToast(`${draft.accountLabel} saved.`);
    return true;
  };

  const addToolDetailAccountDraft = () => {
    const draftId = `new-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
    setToolDetailDrafts((currentDrafts) => ({
      ...currentDrafts,
      [draftId]: {
        draftId,
        accountLabel: "",
        billingAmounts: [{
          amount: "",
          billingType: "Monthly",
          currency: defaultCurrency,
          id: billingAmountId(),
        }],
        billingType: "Monthly",
        lastTopUpDate: "",
        nextChargeDate: "",
        plan: "",
        planName: "",
        status: "Active",
        trialExpiryDate: "",
      },
    }));
  };

  const saveAllToolDetailAccounts = async (
    tool: ToolItem,
    drafts: ToolDetailAccountDraft[],
  ) => {
    const accountLabels = drafts.map((draft) => draft.accountLabel).filter(Boolean);
    const removedAccountLabels = tool.accounts.filter((accountLabel) => !accountLabels.includes(accountLabel));
    const hasIncompleteDraft = drafts.some((draft) => !draft.accountLabel || !draft.plan);
    const hasDuplicateAccount = new Set(accountLabels).size !== accountLabels.length;
    if (hasIncompleteDraft || hasDuplicateAccount) {
      showToast(hasDuplicateAccount
        ? "Each account can only be linked once."
        : "Select an account and plan for every account.");
      return;
    }

    const previousTools = toolList;
    setToolList((currentTools) => currentTools.map((currentTool) => (
      currentTool.id === tool.id ? { ...currentTool, accounts: accountLabels } : currentTool
    )));

    if (shouldUseSupabase) {
      try {
        await replaceToolLinks(tool.id, accountLabels, accountList);
      } catch (error) {
        setToolList(previousTools);
        setToolDataError(error instanceof Error ? error.message : "Could not update linked accounts.");
        return;
      }
    }

    if (removedAccountLabels.length > 0) {
      const removeOmittedAccounts = <T,>(current: Record<string, Record<string, T>>) => {
        const nextForTool = { ...(current[tool.id] ?? {}) };
        removedAccountLabels.forEach((accountLabel) => {
          delete nextForTool[accountLabel];
        });
        return { ...current, [tool.id]: nextForTool };
      };
      setToolAccountStatuses(removeOmittedAccounts);
      setToolAccountPlanNames(removeOmittedAccounts);
      setToolAccountDetails(removeOmittedAccounts);
    }

    for (const draft of drafts) {
      const saved = await saveToolDetailAccount(tool, draft, false);
      if (!saved) return;
    }
    showToast(`${tool.name} accounts saved.`);
    closeManageAccountModal();
  };

  const archiveManagedLinkTool = async () => {
    if (!managingLink) return;
    await archiveToolIds([managingLink.toolId]);
    closeManageAccountModal();
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
        billingType: normaliseBillingType(managedBillingType),
        currency: normaliseCurrency(managedBillingAmounts[0]?.currency),
        lastTopUpDate: nextToolDetails[managedAccountLabel]?.lastTopUpDate ?? "",
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
          billingType: normaliseBillingType(managedBillingType),
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
      lastTopUpDate: currentDetail?.lastTopUpDate ?? "",
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

  const updateLinkedManageStatus = async (tool: ToolItem, accountLabel: string, status: ManageStatus) => {
    const currentDetail = toolAccountDetails[tool.id]?.[accountLabel];
    const nextDetail: ToolAccountDetail = {
      amount: currentDetail?.amount ?? "",
      billingAmounts: currentDetail?.billingAmounts,
      billingType: normaliseBillingType(currentDetail?.billingType ?? "Monthly"),
      currency: normaliseCurrency(currentDetail?.currency),
      lastTopUpDate: currentDetail?.lastTopUpDate ?? "",
      nextChargeDate: currentDetail?.nextChargeDate ?? "",
      planName: currentDetail?.planName ?? toolAccountPlanNames[tool.id]?.[accountLabel] ?? "",
      status,
      trialExpiryDate: currentDetail?.trialExpiryDate ?? "",
    };

    setToolAccountDetails((current) => ({
      ...current,
      [tool.id]: { ...(current[tool.id] ?? {}), [accountLabel]: nextDetail },
    }));
    setToolDetailDrafts((current) => current[accountLabel]
      ? { ...current, [accountLabel]: { ...current[accountLabel], status } }
      : current);

    if (shouldUseSupabase) {
      try {
        await updateToolLinkDetails(tool.id, accountLabel, accountList, {
          amount: nextDetail.amount,
          billingType: nextDetail.billingType,
          currency: nextDetail.currency,
          nextChargeDate: nextDetail.nextChargeDate,
          plan: relationPlanStatusValue(tool, accountLabel),
          planName: nextDetail.planName,
          status,
          trialExpiryDate: nextDetail.trialExpiryDate,
        });
      } catch (error) {
        setToolDataError(error instanceof Error ? error.message : "Could not update account status.");
      }
    }
  };

  const saveToolLink = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    setHasSubmittedLinkToolForm(true);
    const selectedTool = toolList.find((tool) => tool.id === linkToolId);

    const filledBlocks = linkToolAccountBlocks.filter(
      (block): block is LinkToolAccountBlock & { plan: ToolStatus } => Boolean(block.accountLabel && block.plan),
    );
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
            billingAmounts: block.plan === "Active"
              ? normaliseBillingType(block.billingType).split(", ").filter(Boolean).map((billingType) => ({
                  amount: "",
                  billingType,
                  currency: "USD",
                  id: billingAmountId(),
                }))
              : [],
            billingType: normaliseBillingType(block.billingType),
            currency: "USD",
            lastTopUpDate: block.plan === "Active" && normaliseBillingType(block.billingType).split(", ").includes("Top-up")
              ? block.lastTopUpDate
              : "",
            nextChargeDate: block.plan === "Active" && normaliseBillingType(block.billingType).split(", ").some((billingType) => billingType !== "Top-up")
              ? block.nextChargeDate
              : "",
            planName: block.plan === "Active" ? block.planName.trim() : "",
            status: "Active",
            trialExpiryDate: block.plan === "Trial" ? block.trialExpiryDate : "",
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
              billingType: normaliseBillingType(block.billingType),
              currency: "USD",
              lastTopUpDate: block.plan === "Active" && normaliseBillingType(block.billingType).split(", ").includes("Top-up")
                ? block.lastTopUpDate
                : "",
              nextChargeDate: block.plan === "Active" && normaliseBillingType(block.billingType).split(", ").some((billingType) => billingType !== "Top-up")
                ? block.nextChargeDate
                : "",
              plan: block.plan,
              planName: block.plan === "Active" ? block.planName.trim() : "",
              status: "Active",
              trialExpiryDate: block.plan === "Trial" ? block.trialExpiryDate : "",
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
          ? { ...tool, archived: true, archivedAt, archivedStatus: linkedPlanSnapshot(tool) }
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
              archivedStatus: linkedPlanSnapshot(tool),
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

  const activeToolSearchQuery =
    activeSection === "tools"
      ? toolboxSearch
      : activeSection === "linked"
        ? linkedSearch
        : activeSection === "billing"
          ? billingSearch
          : activeSection === "watchlist"
            ? watchlistSearch
            : activeSection === "favorites"
              ? favouritesSearch
              : activeSection === "archive"
                ? archivedSearch
                : "";
  const setActiveToolSearchQuery = (value: string) => {
    if (activeSection === "tools") setToolboxSearch(value);
    else if (activeSection === "linked") setLinkedSearch(value);
    else if (activeSection === "billing") setBillingSearch(value);
    else if (activeSection === "watchlist") setWatchlistSearch(value);
    else if (activeSection === "favorites") setFavouritesSearch(value);
    else if (activeSection === "archive") setArchivedSearch(value);
  };
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

    const query = activeToolSearchQuery.trim().toLowerCase();
    const nextTools = filterBySection()
      .filter((tool) => isInSelectedRange(tool.name))
      .filter((tool) => {
        if (activeSection !== "linked" || linkedPlanFilter === "All") return true;

        return tool.accounts.some((accountLabel) => {
          const status = toolAccountStatuses[tool.id]?.[accountLabel] ?? tool.status;
          const plan = status === "Active" || status === "Paid" ? "Paid" : status === "Trial" ? "Trial" : "Free";
          return plan === linkedPlanFilter;
        });
      })
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
  }, [activeCategory, activeSection, activeToolSearchQuery, hasCustomToolOrder, linkedPlanFilter, selectedToolSort, toolAccountStatuses, toolsWithValidAccountLinks]);
  const totalToolboxCount = useMemo(
    () => toolsWithValidAccountLinks.filter((tool) => !tool.archived).length,
    [toolsWithValidAccountLinks],
  );
  const totalLinkedToolCount = useMemo(
    () => toolsWithValidAccountLinks.filter((tool) => tool.accounts.length > 0 && !tool.archived).length,
    [toolsWithValidAccountLinks],
  );
  const totalWatchlistToolCount = useMemo(
    () => toolsWithValidAccountLinks.filter((tool) => tool.status === "Considering" && !tool.archived).length,
    [toolsWithValidAccountLinks],
  );
  const totalFavouriteToolCount = useMemo(
    () => toolsWithValidAccountLinks.filter((tool) => tool.favorite && !tool.archived).length,
    [toolsWithValidAccountLinks],
  );
  const totalArchivedToolCount = useMemo(
    () => toolsWithValidAccountLinks.filter((tool) => tool.archived).length,
    [toolsWithValidAccountLinks],
  );
  const toolSearchTerm = activeToolSearchQuery.trim();
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
    () =>
      sortCategoriesWithUncategorizedLast(
        normaliseCategoryList([
          ...defaultToolCategories,
          ...workspaceCategories,
          ...customToolCategories,
          ...toolsWithValidAccountLinks.map((tool) => tool.category),
        ]),
      ),
    [customToolCategories, toolsWithValidAccountLinks, workspaceCategories],
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
      const query = activeToolSearchQuery.trim();

      const groups = visibleWorkspaceCategories
        .map((category) => ({
          category,
          tools: visibleTools.filter((tool) => tool.category === category),
        }))
        .filter((group) => {
          if (query) return group.tools.length > 0;
          if (activeSection === "tools") return group.tools.length > 0;

          return group.category !== "Uncategorized" || group.tools.length > 0;
        });

      if (activeSection !== "watchlist" || query) return groups;

      return [...groups].sort((firstGroup, secondGroup) => {
        const firstIsEmpty = firstGroup.tools.length === 0;
        const secondIsEmpty = secondGroup.tools.length === 0;

        return Number(firstIsEmpty) - Number(secondIsEmpty);
      });
    },
    [activeSection, activeToolSearchQuery, visibleWorkspaceCategories, visibleTools],
  );
  const populatedToolboxCategories = useMemo(() => {
    const populated = new Set(
      toolsWithValidAccountLinks
        .filter((tool) => !tool.archived)
        .map((tool) => tool.category),
    );
    return visibleWorkspaceCategories.filter((category) => populated.has(category));
  }, [toolsWithValidAccountLinks, visibleWorkspaceCategories]);
  const toolboxClusterGroups = useMemo(() => {
    const groupedByCategory = new Map(groupedToolCategories.map((group) => [group.category, group]));
    const configuredCategoryLabels = new Set(defaultToolCategories);
    const clusters = toolboxPresets.clusters
      .map((cluster) => ({
        ...cluster,
        groups: cluster.categories
          .map((categoryId) => presetCategoryById.get(categoryId)?.label)
          .map((categoryLabel) => (categoryLabel ? groupedByCategory.get(categoryLabel) : undefined))
          .filter((group): group is { category: string; tools: ToolItem[] } => Boolean(group)),
      }))
      .filter((cluster) => cluster.groups.length > 0);
    const customGroups = groupedToolCategories.filter((group) => !configuredCategoryLabels.has(group.category));

    if (customGroups.length > 0) {
      const otherCluster = clusters.find((cluster) => cluster.id === "other");
      if (otherCluster) otherCluster.groups.push(...customGroups);
      else clusters.push({ categories: [], groups: customGroups, id: "other", label: "Other" });
    }

    return clusters;
  }, [groupedToolCategories]);
  const toolboxSidebarCategoryGroups = useMemo(() => {
    const populated = new Set(populatedToolboxCategories);
    const configuredCategoryLabels = new Set(defaultToolCategories);
    const clusters = toolboxPresets.clusters
      .map((cluster) => ({
        ...cluster,
        categories: cluster.categories
          .map((categoryId) => presetCategoryById.get(categoryId)?.label)
          .filter(
            (category): category is string =>
              typeof category === "string" && populated.has(category),
          ),
      }))
      .filter((cluster) => cluster.categories.length > 0);
    const customCategories = populatedToolboxCategories.filter(
      (category) => !configuredCategoryLabels.has(category),
    );

    if (customCategories.length > 0) {
      const otherCluster = clusters.find((cluster) => cluster.id === "other");
      if (otherCluster) otherCluster.categories.push(...customCategories);
      else clusters.push({ categories: customCategories, id: "other", label: "Other" });
    }

    return clusters;
  }, [populatedToolboxCategories]);
  const toolboxSidebarClusters = useMemo(
    () => toolboxPresets.clusters.filter((cluster) => toolboxSidebarClusterIds.has(cluster.id)),
    [],
  );

  const scrollToToolboxCluster = (clusterId: string) => {
    setActiveSection("tools");
    setActiveCategory("");
    setSelectedToolSort("Category");
    setShowRecoveryPanel(false);
    setIsSidebarOpen(false);
    setActiveToolboxClusterId(clusterId);

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document.getElementById(`toolbox-cluster-${clusterId}`)?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    });
  };

  useEffect(() => {
    const scrollContainer = mainContentRef.current;
    if (
      !scrollContainer ||
      activeSection !== "tools" ||
      activeCategory ||
      selectedToolSort !== "Category"
    ) {
      return;
    }

    const updateActiveCluster = () => {
      const clusterHeaders = Array.from(
        scrollContainer.querySelectorAll<HTMLElement>("[data-toolbox-cluster-anchor]"),
      );
      if (clusterHeaders.length === 0) return;

      const activationLine = scrollContainer.getBoundingClientRect().top + 150;
      const activeHeader =
        [...clusterHeaders]
          .reverse()
          .find((header) => header.getBoundingClientRect().top <= activationLine) ??
        clusterHeaders[0];
      setActiveToolboxClusterId(activeHeader.dataset.toolboxClusterAnchor ?? "everyday");
    };

    updateActiveCluster();
    scrollContainer.addEventListener("scroll", updateActiveCluster, { passive: true });
    return () => scrollContainer.removeEventListener("scroll", updateActiveCluster);
  }, [activeCategory, activeSection, selectedToolSort, toolboxClusterGroups]);

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
      ? "Logins"
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
    billing: "All your bills, one place, no surprises.",
    watchlist: "Tools you're considering. Keep them close before you link an account.",
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
  const trialsNeedingConfirmation = remindersEnabled ? toolsWithValidAccountLinks
    .filter((tool) => !tool.archived)
    .flatMap((tool) => tool.accounts.flatMap((accountLabel) => {
      const detail = toolAccountDetails[tool.id]?.[accountLabel];
      const daysRemaining = detail?.trialExpiryDate ? daysUntilDate(detail.trialExpiryDate) : null;
      if (relationStatus(tool, accountLabel) !== "Trial" || daysRemaining === null || daysRemaining >= 0) return [];
      return [{ accountLabel, tool }];
    })) : [];
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

  const relationPlan = (tool: ToolItem, accountLabel: string) => {
    const status = relationStatus(tool, accountLabel);
    if (status === "Active" || status === "Paid") return "Paid";
    const override = toolPlanOverrideFor(tool);
    if (override) return override.not_paid_label;
    if (status === "Trial") return "Trial";
    return "Free";
  };

  const relationPlanStatusValue = (tool: ToolItem, accountLabel: string): ToolStatus => {
    const plan = relationPlan(tool, accountLabel);
    if (plan === "Paid") return "Active";
    if (plan === "Trial") return "Trial";
    return "Free Tier";
  };

  const planPillTone = (plan: string) => {
    if (plan === "Paid") return "status-running";
    if (plan === "Trial") return "status-trial";
    if (plan === "Free") return "status-free";
    return "status-muted";
  };

  const billingTypeOptions: DropdownOption[] = ["Monthly", "Yearly", "Lifetime", "One-time", "Top-up"].map((billingType) => ({
    label: billingType,
    value: billingType,
  }));
  const linkBillingTypeOptions: DropdownOption[] = ["Monthly", "Yearly", "Lifetime", "One-time", "Top-up"].map((billingType) => ({
    label:
      billingType === "One-time"
        ? "One-time payment"
        : billingType === "Top-up"
          ? "Top-up credit"
          : billingType,
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
          (toolAccountDetails[tool.id]?.[secondAccount.accountLabel]?.nextChargeDate ?? "").localeCompare(
            toolAccountDetails[tool.id]?.[firstAccount.accountLabel]?.nextChargeDate ?? "",
          ) ||
          firstAccount.index - secondAccount.index,
      )
      .map((account) => account.accountLabel);

  const linkedAccountLabelsForDisplay = (tool: ToolItem) => {
    const accountLabels = orderedLinkedAccountLabels(tool);
    if (linkedPlanFilter === "All") return accountLabels;
    return accountLabels.filter((accountLabel) => relationPlan(tool, accountLabel) === linkedPlanFilter);
  };

  const allBillingRows = toolsWithValidAccountLinks
    .filter((tool) => !tool.archived)
    .flatMap((tool) =>
      tool.accounts.flatMap((accountLabel) => {
        if (relationPlan(tool, accountLabel) !== "Paid") return [];

        const detail = toolAccountDetails[tool.id]?.[accountLabel];
        const billingAmounts = detail?.billingAmounts ?? [];
        return billingAmounts.map((billingAmount) => ({
            accountLabel,
            amount: billingAmount.amount,
            billingType: normaliseBillingType(billingAmount.billingType),
            currency: normaliseCurrency(billingAmount.currency),
            id: billingAmount.id,
            nextChargeDate: detail?.nextChargeDate ?? "",
            planName: detail?.planName ?? toolAccountPlanNames[tool.id]?.[accountLabel] ?? "",
            tool,
          }));
      }),
    );
  const billingSearchTerm = billingSearch.trim();
  const billingRows = allBillingRows
    .filter((row) => {
      const query = billingSearchTerm.toLowerCase();
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
      (secondRow.nextChargeDate ?? "").localeCompare(firstRow.nextChargeDate ?? "") ||
      firstRow.accountLabel.localeCompare(secondRow.accountLabel),
    );

  const renderLinkedAccountCell = (accountLabel: string, compact = false) => {
    const accountDetails = accountList.find((account) => account.label === accountLabel);
    const tagClass = accountTag(accountLabel, accountList);

    return (
      <LinkedAccountCell
        accountLabel={accountLabel}
        compact={compact}
        login={accountDetails?.login}
        tagClass={tagClass}
      />
    );
  };

  const renderBillingAccountCell = (accountLabel: string) => {
    const tagClass = accountTag(accountLabel, accountList);
    return <BillingAccountCell accountLabel={accountLabel} tagClass={tagClass} />;
  };

  const linkedPlanName = (tool: ToolItem, accountLabel: string) => (
      toolAccountDetails[tool.id]?.[accountLabel]?.planName ??
      toolAccountPlanNames[tool.id]?.[accountLabel] ??
      ""
    ).trim();

  const linkedTrialDaysRemaining = (tool: ToolItem, accountLabel: string) => {
    const trialExpiryDate = toolAccountDetails[tool.id]?.[accountLabel]?.trialExpiryDate ?? "";
    return trialExpiryDate ? daysUntilDate(trialExpiryDate) : null;
  };

  const linkedPlanPillText = (tool: ToolItem, accountLabel: string, plan: string) => {
    if (plan === "Paid") return linkedPlanName(tool, accountLabel) || "Paid";
    if (plan !== "Trial") return plan;

    const daysRemaining = linkedTrialDaysRemaining(tool, accountLabel);
    if (daysRemaining === null) return "Trial";
    return daysRemaining < 0 ? "Trial · ended" : `Trial · ${daysRemaining}d left`;
  };

  const linkedPlanPillTone = (tool: ToolItem, accountLabel: string, plan: string) => {
    if (plan !== "Trial") return planPillTone(plan);
    const daysRemaining = linkedTrialDaysRemaining(tool, accountLabel);
    return daysRemaining !== null && daysRemaining <= 3 ? "status-trial-danger" : "status-trial";
  };

  const renderBillingRow = (
    row: (typeof billingRows)[number],
    options: {
      isAccountContinuation?: boolean;
      isPlanGroupEnd?: boolean;
      isPlanGroupStart?: boolean;
      isPlanGrouped?: boolean;
      isPlanContinuation?: boolean;
      isToolContinuation?: boolean;
    } = {},
  ) => {
    const {
      isAccountContinuation = false,
      isPlanGroupEnd = false,
      isPlanGroupStart = false,
      isPlanGrouped = false,
      isPlanContinuation = false,
      isToolContinuation = false,
    } = options;

    return (
    <article
      className={[
        "account-table-row tool-table-row billing-tool-row",
        isToolContinuation ? "is-tool-continuation" : "",
        isAccountContinuation ? "is-account-continuation is-continuation" : "",
        isPlanGrouped ? "is-plan-grouped" : "",
        isPlanGroupStart ? "is-plan-group-start" : "",
        isPlanGroupEnd ? "is-plan-group-end" : "",
        isPlanContinuation ? "is-plan-continuation" : "",
      ].filter(Boolean).join(" ")}
      key={row.id}
    >
      <div data-label="Tool Name">
        {isToolContinuation ? null : (
          <BillingToolNameCell
            accountLabel={row.accountLabel}
            displayName={displayToolName(row.tool.name)}
            logoBackground={row.tool.logoBg}
            logoText={toolInitials(row.tool.name)}
            onOpenHistory={() => setBillingHistoryTarget({ accountLabel: row.accountLabel, toolId: row.tool.id })}
          />
        )}
      </div>
      <div data-label="Account">{isAccountContinuation ? null : renderBillingAccountCell(row.accountLabel)}</div>
      <span className={isPlanGrouped ? "billing-plan-name is-grouped-plan" : "billing-plan-name"} data-label="Plan Name">
        <input
          aria-label={`${row.tool.name} ${row.accountLabel} plan name`}
          className="billing-inline-field billing-plan-name-input"
          defaultValue={row.planName}
          key={row.planName || "empty-plan-name"}
          onBlur={(event) => {
            const nextPlanName = event.currentTarget.value.trim();
            if (nextPlanName !== row.planName) {
              updateBillingField(row.tool.id, row.accountLabel, { planName: nextPlanName });
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
          placeholder="Not set"
          type="text"
        />
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
                      billingAmounts: (detail.billingAmounts?.length
                        ? detail.billingAmounts
                        : normaliseBillingType(detail.billingType ?? "Monthly")
                            .split(", ")
                            .filter(Boolean)
                            .map((billingType, index) => ({
                              amount: index === 0 ? detail.amount : "",
                              billingType,
                              currency: normaliseCurrency(detail.currency),
                              id: billingAmountId(),
                            }))).map((entry) =>
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
                        billingAmounts: (detail.billingAmounts?.length
                          ? detail.billingAmounts
                          : normaliseBillingType(detail.billingType ?? "Monthly")
                              .split(", ")
                              .filter(Boolean)
                              .map((billingType, index) => ({
                                amount: index === 0 ? detail.amount : "",
                                billingType,
                                currency: normaliseCurrency(detail.currency),
                                id: billingAmountId(),
                              }))).map((entry) =>
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
      <span data-label="Billing Type">
        {renderDropdown({
          ariaLabel: `${row.tool.name} ${row.accountLabel} billing type`,
          className: "billing-type-dropdown",
          id: `billing-type-${row.tool.id}-${row.accountLabel}-${row.billingType}`,
          onChange: (nextBillingType) =>
            updateBillingField(row.tool.id, row.accountLabel, { billingType: normaliseBillingType(nextBillingType) }),
          options: billingTypeOptions,
          value: row.billingType,
        })}
      </span>
      <span data-label="Next Charge">
        <label
          className={`billing-date-picker billing-date-picker-table ${row.nextChargeDate ? "has-value" : "is-empty"}`}
          onClick={(event) => {
            event.preventDefault();
            const input = event.currentTarget.querySelector<HTMLInputElement>("input[type=date]");
            if (typeof input?.showPicker === "function") input.showPicker();
            else input?.focus();
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            const input = event.currentTarget.querySelector<HTMLInputElement>("input[type=date]");
            if (typeof input?.showPicker === "function") input.showPicker();
            else input?.focus();
          }}
          role="button"
          tabIndex={0}
        >
          {row.nextChargeDate ? (
            <span className="billing-date-value">{formatBillingDate(row.nextChargeDate)}</span>
          ) : (
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <rect x="4" y="5.5" width="16" height="14" rx="2" />
              <path d="M8 3.5v4M16 3.5v4M4 9.5h16" />
            </svg>
          )}
          <input
            aria-label={`${row.tool.name} ${row.accountLabel} next charge`}
            className="billing-native-date-input"
            onChange={(event) => updateBillingField(row.tool.id, row.accountLabel, { nextChargeDate: event.target.value })}
            tabIndex={-1}
            type="date"
            value={row.nextChargeDate}
          />
        </label>
      </span>
      <span className="row-actions billing-row-actions" data-label="Action">
        <button
          className="action-btn"
          onClick={() => openManageAccountModal(row.tool, row.accountLabel)}
          type="button"
        >
          Edit
        </button>
      </span>
    </article>
    );
  };

  const renderLinkedStatusControl = (tool: ToolItem, accountLabel: string) => {
    const plan = relationPlan(tool, accountLabel);
    return plan === "Trial" &&
      Boolean(toolAccountDetails[tool.id]?.[accountLabel]?.trialExpiryDate) &&
      (daysUntilDate(toolAccountDetails[tool.id]?.[accountLabel]?.trialExpiryDate ?? "") ?? 0) < 0
      ? renderDropdown({
          ariaLabel: `Confirm expired trial status for ${tool.name} ${accountLabel}`,
          className: "billing-type-dropdown linked-manage-status-dropdown linked-trial-status-dropdown",
          id: `linked-trial-status-${tool.id}-${accountLabel}`,
          onChange: (outcome) => resolveExpiredTrialStatus(tool, accountLabel, outcome as "converted" | "ended"),
          options: [
            { disabled: true, label: "Confirm status", value: "" },
            { label: "Trial converted to paid", value: "converted" },
            { label: "Trial ended / cancelled", value: "ended" },
          ],
          value: "",
        })
      : renderDropdown({
          ariaLabel: `Change ${tool.name} ${accountLabel} status`,
          className: "billing-type-dropdown linked-manage-status-dropdown",
          id: `linked-manage-status-${tool.id}-${accountLabel}`,
          onChange: (nextStatus) => updateLinkedManageStatus(tool, accountLabel, nextStatus as ManageStatus),
          options: [
            { label: "Active", value: "Active" },
            { label: "On a break", value: "On a Break" },
            { label: "Goodbye", value: "Goodbye" },
          ],
          value: toolAccountDetails[tool.id]?.[accountLabel]?.status ?? "Active",
        });
  };

  const renderToolRow = (tool: ToolItem) => {
    const isExpanded = expandedToolIds.includes(tool.id);
    return (
      <ToolRowRenderer
        accountLabels={linkedAccountLabelsForDisplay(tool)}
        archivedOn={formatArchiveDate(tool.archivedAt)}
        isExpanded={isExpanded}
        isSelected={selectedToolIds.includes(tool.id)}
        key={tool.id}
        onDelete={() => permanentlyDeleteToolIds([tool.id])}
        onEdit={() => openEditToolModal(tool)}
        onEditAccount={(accountLabel) => openManageAccountModal(tool, accountLabel)}
        onOpenLinkedAccounts={() => {
          if (tool.accounts.length > 0) {
            openManageAccountModal(tool, orderedLinkedAccountLabels(tool)[0]);
            return;
          }
          openLinkToolModal(tool);
        }}
        onOpenLinkState={() => {
          if (tool.accounts.length > 0) {
            openManageAccountModal(tool, orderedLinkedAccountLabels(tool)[0]);
            return;
          }
          activeSection === "watchlist"
            ? openLinkToolModal(tool, { activateToolOnSave: true })
            : openLinkToolModal(tool);
        }}
        onRemoveFavourite={() => {
          toggleToolFavorite(tool.name);
          showToast("Removed from Favourites.");
        }}
        onRestore={() => setConfirmToolStateChange({ action: "unarchive", tool })}
        onToggleExpanded={() => toggleToolExpanded(tool.id)}
        onToggleFavorite={() => toggleToolFavorite(tool.name)}
        onToggleSelected={() => toggleToolSelection(tool.id)}
        onToggleWatchlist={() => {
          if (activeSection === "watchlist" && tool.status === "Considering") {
            setConfirmToolStateChange({ action: "unwatchlist", tool });
            return;
          }
          toggleToolWatchlist(tool.id);
        }}
        renderAccount={renderLinkedAccountCell}
        renderCategory={() => renderCategoryCell(tool)}
        renderLastStatus={() => (
          <span className={`tool-status-chip ${archivedStatusTone(linkedPlanSnapshot(tool))}`}>
            {archivedStatusLabel(linkedPlanSnapshot(tool))}
          </span>
        )}
        renderPlan={(accountLabel) => {
          const plan = relationPlan(tool, accountLabel);
          return (
            <span className={`tool-status-chip ${linkedPlanPillTone(tool, accountLabel, plan)}`}>
              {linkedPlanPillText(tool, accountLabel, plan)}
            </span>
          );
        }}
        renderSingleAccount={(accountLabel) => (
          <span className={`email-tag ${accountTag(accountLabel, accountList)}`}>
            <span className="tag-dot" />
            {accountLabel}
          </span>
        )}
        renderStatusControl={(accountLabel) => renderLinkedStatusControl(tool, accountLabel)}
        renderToolName={() => (
          <ToolNameCell
            displayName={displayToolName(tool.name)}
            draft={toolNameDraft}
            isEditing={editingToolName === tool.name}
            logoBackground={tool.logoBg}
            logoText={toolInitials(tool.name)}
            name={tool.name}
            onDraftChange={setToolNameDraft}
            onKeyDown={handleInlineToolNameKeyDown}
            onSave={saveInlineToolName}
            onStartEditing={() => startEditingToolName(tool)}
          />
        )}
        renderUrl={() => <PricingUrlIcon name={tool.name} pricingUrl={tool.pricingUrl} />}
        section={activeSection}
        tool={tool}
      />
    );
  };

  const renderToolCategoryGroup = (group: { category: string; tools: ToolItem[] }) => {
    const categoryPreset = presetCategoryByLabel.get(group.category);
    const toggleGroupSelection = () => {
      const groupToolIds = group.tools.map((tool) => tool.id);
      const areAllGroupToolsSelected = groupToolIds.every((toolId) => selectedToolIds.includes(toolId));
      setSelectedToolIds((currentIds) => {
        const groupIds = new Set(groupToolIds);
        return areAllGroupToolsSelected
          ? currentIds.filter((toolId) => !groupIds.has(toolId))
          : Array.from(new Set([...currentIds, ...groupToolIds]));
      });
    };

    return (
      <ToolCategoryGroup
        category={group.category}
        isToolboxSection={activeSection === "tools"}
        key={group.category}
        onToggleSelection={toggleGroupSelection}
        renderToolRow={renderToolRow}
        subgroups={categoryPreset?.subgroups}
        tools={group.tools}
      />
    );
  };

  const managedTool = managingLink ? toolList.find((tool) => tool.id === managingLink.toolId) : null;
  const hasUnsavedToolDetailChanges = JSON.stringify(toolDetailDrafts) !== JSON.stringify(originalToolDetailDrafts);
  const orderedToolDetailDrafts = managedTool
    ? (() => {
        const orderedDrafts = [
          ...Array.from(new Set(orderedLinkedAccountLabels(managedTool)))
            .map((accountLabel) => toolDetailDrafts[accountLabel])
            .filter((draft): draft is ToolDetailAccountDraft => Boolean(draft)),
          ...Object.entries(toolDetailDrafts)
            .filter(
              ([draftId, draft]) =>
                !managedTool.accounts.includes(draftId) &&
                !managedTool.accounts.includes(draft.accountLabel),
            )
            .map(([, draft]) => draft),
        ];
        return orderedDrafts.filter(
          (draft, index) =>
            orderedDrafts.findIndex(
              (candidate) =>
                (candidate.draftId ?? candidate.accountLabel) === (draft.draftId ?? draft.accountLabel),
            ) === index,
        );
      })()
    : [];
  useEffect(() => {
    if (!managingLink) return;
    const frameId = window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(".tool-detail-modal")?.scrollTo({ top: 0 });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [managingLink]);
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
    : activeToolOptions.filter((tool) => tool.accounts.length === 0 && tool.status !== "Considering");
  const filteredLinkToolOptions = linkToolSearchOptions.filter((tool) =>
    tool.name.toLowerCase().includes(linkToolSearchQuery.trim().toLowerCase()),
  );
  const selectedLinkTool = toolList.find((tool) => tool.id === linkToolId);
  const selectedLinkToolAllowedPlans = selectedLinkTool
    ? (toolPlanOverrideFor(selectedLinkTool)?.supported_tiers ?? toolPlanTiers.default_tiers)
    : undefined;
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
  useEffect(() => {
    if (!selectedLinkToolAllowedPlans?.length) return;

    const isPaidOnly = selectedLinkToolAllowedPlans.length === 1 && selectedLinkToolAllowedPlans[0] === "paid";
    const firstAllowedStatus: ToolStatus | "" = isPaidOnly
      ? ""
      : statusForPlanKey(selectedLinkToolAllowedPlans[0]);
    setLinkToolAccountBlocks((currentBlocks) => {
      const nextBlocks = currentBlocks.map((block) =>
        block.plan && selectedLinkToolAllowedPlans.includes(planKeyForStatus(block.plan))
          ? block
          : { ...block, plan: firstAllowedStatus },
      );

      return nextBlocks.some((block, index) => block.plan !== currentBlocks[index].plan) ? nextBlocks : currentBlocks;
    });
  }, [selectedLinkToolAllowedPlans]);

  const billingHistoryToolName = billingHistoryTarget
    ? displayToolName(toolList.find((tool) => tool.id === billingHistoryTarget.toolId)?.name ?? "Tool")
    : "Tool";
  const billingHistoryTool = billingHistoryTarget
    ? toolList.find((tool) => tool.id === billingHistoryTarget.toolId)
    : undefined;
  const billingHistorySections: BillingHistorySection[] = billingHistoryTool
    ? orderedLinkedAccountLabels(billingHistoryTool)
        .filter((accountLabel) => relationPlan(billingHistoryTool, accountLabel) === "Paid")
        .map((accountLabel) => {
          const detail = toolAccountDetails[billingHistoryTool.id]?.[accountLabel];
          const recordKey = `${billingHistoryTool.id}::${accountLabel}`;
          const amounts = detail
            ? (detail.billingAmounts?.length
                ? detail.billingAmounts
                : normaliseBillingType(detail.billingType ?? "Monthly")
                    .split(", ")
                    .filter(Boolean)
                    .map((billingType, index) => ({
                      amount: index === 0 ? detail.amount : "",
                      billingType,
                      currency: normaliseCurrency(detail.currency),
                    })))
            : [];
          const generatedEntries: BillingHistoryEntry[] = amounts.map((billingAmount, index) => {
            const id = `generated-${normaliseBillingType(billingAmount.billingType)}-${index}`;
            return {
              amount: billingAmount.amount
                ? `${normaliseCurrency(billingAmount.currency)} ${billingAmount.amount}`
                : undefined,
              billingType: normaliseBillingType(billingAmount.billingType),
              date: detail?.nextChargeDate ? formatBillingDate(detail.nextChargeDate) : "—",
              event: "Charged",
              id,
              note: billingHistoryNotes[`${recordKey}::${id}`] ?? [detail?.planName, normaliseBillingType(billingAmount.billingType)]
                .filter(Boolean)
                .join(" · "),
              planName: detail?.planName ?? "",
              source: "generated",
            };
          });
          return {
            accountLabel,
            entries: [...generatedEntries, ...(manualBillingHistory[recordKey] ?? [])],
            planName: detail?.planName ?? "",
          };
        })
    : [];
  const updateBillingHistoryNote = (recordKey: string, entry: BillingHistoryEntry, note: string) => {
    if (entry.source === "generated") {
      setBillingHistoryNotes((current) => (
        updateGeneratedBillingHistoryNote(current, recordKey, entry.id, note)
      ));
      return;
    }
    setManualBillingHistory((current) => (
      updateManualBillingHistoryNote(current, recordKey, entry.id, note)
    ));
  };

  const pendingBillingActions = Object.entries(manualBillingHistory).flatMap(([recordKey, entries]) => {
    const separatorIndex = recordKey.indexOf("::");
    const toolId = separatorIndex >= 0 ? recordKey.slice(0, separatorIndex) : recordKey;
    const accountLabel = separatorIndex >= 0 ? recordKey.slice(separatorIndex + 2) : "Account";
    const tool = toolList.find((item) => item.id === toolId);

    return entries
      .filter((entry) => entry.event === "Double Charged")
      .filter((entry) => !entries.some((candidate) => candidate.resolvesEntryId === entry.id))
      .map((entry) => ({ accountLabel, entry, recordKey, tool }));
  });

  const todayInputValue = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const startResolvingPendingAction = (entryId: string) => {
    setResolvingPendingActionId(entryId);
    setPendingResolutionOutcome("Charged");
    setPendingResolutionDate(todayInputValue());
  };

  const confirmPendingActionResolution = (recordKey: string, entry: BillingHistoryEntry) => {
    if (!pendingResolutionDate) return;

    const resolutionEntry = createPendingResolutionEntry(
      entry,
      pendingResolutionOutcome,
      pendingResolutionDate,
    );

    setManualBillingHistory((current) => ({
      ...current,
      [recordKey]: [...(current[recordKey] ?? []), resolutionEntry],
    }));
    setPendingResolutionConfirmation(null);
    setResolvingPendingActionId("");
  };

  const resolveExpiredTrialStatus = async (
    tool: ToolItem,
    accountLabel: string,
    outcome: "converted" | "ended",
  ) => {
    const detail = toolAccountDetails[tool.id]?.[accountLabel];
    const nextPlan: ToolStatus = outcome === "converted" ? "Active" : "Free Tier";
    await updateRelationStatus(tool.id, accountLabel, nextPlan);
    setToolAccountDetails((current) => ({
      ...current,
      [tool.id]: {
        ...(current[tool.id] ?? {}),
        [accountLabel]: {
          amount: detail?.amount ?? "",
          billingAmounts: detail?.billingAmounts,
          billingType: normaliseBillingType(detail?.billingType ?? "Monthly"),
          currency: normaliseCurrency(detail?.currency),
          lastTopUpDate: detail?.lastTopUpDate ?? "",
          nextChargeDate: detail?.nextChargeDate ?? "",
          planName: detail?.planName ?? "",
          status: detail?.status ?? "Active",
          trialExpiryDate: "",
        },
      },
    }));

    if (outcome === "converted") {
      const recordKey = `${tool.id}::${accountLabel}`;
      const conversionEntry: BillingHistoryEntry = {
        amount: detail?.amount ?? "",
        billingType: normaliseBillingType(detail?.billingType ?? "Monthly"),
        currency: normaliseCurrency(detail?.currency),
        date: todayInputValue(),
        event: "Trial Converted to Paid",
        id: `trial-converted-${tool.id}-${accountLabel}-${Date.now()}`,
        note: "Trial status confirmed",
        planName: detail?.planName ?? "",
        saved: true,
        source: "manual",
      };
      setManualBillingHistory((current) => ({
        ...current,
        [recordKey]: [...(current[recordKey] ?? []), conversionEntry],
      }));
    }
  };
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

      <Link className="mobile-header-brand" href="/">
        <span className="sidebar-logo-icon">AI</span>
        <span>AI Subprise</span>
      </Link>

      <button
        aria-label="Close dashboard navigation"
        className={isSidebarOpen ? "sidebar-scrim is-visible" : "sidebar-scrim"}
        onClick={() => setIsSidebarOpen(false)}
        type="button"
      />

      <div className={isSidebarCollapsed ? "dashboard-frame sidebar-is-collapsed" : "dashboard-frame"}>
        <DashboardSidebar
          activeCategory={activeCategory}
          activeSection={activeSection}
          hasConfirmedCategories={hasConfirmedCategories}
          hasMoreSidebarAccounts={hasMoreSidebarAccounts}
          isSidebarCollapsed={isSidebarCollapsed}
          isSidebarOpen={isSidebarOpen}
          isToolsNavOpen={isToolsNavOpen}
          navBadgeCounts={navBadgeCounts}
          navItems={navItems}
          onCloseMobile={() => setIsSidebarOpen(false)}
          onSelectAccount={() => {
            window.history.pushState(null, "", accountViewUrl);
            setActiveSection("account");
            setShowRecoveryPanel(false);
            setIsSidebarOpen(false);
          }}
          onSelectCategory={(category) => {
            setActiveSection("tools");
            setActiveCategory(category);
            setSelectedToolSort("All");
            setShowRecoveryPanel(false);
            setIsSidebarOpen(false);
          }}
          onSelectSection={(section) => {
            setActiveSection(section);
            setActiveCategory("");
            setShowRecoveryPanel(false);
            setIsSidebarOpen(false);
          }}
          onSelectTools={() => {
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
          onSelectUtility={(section) => {
            if (section === "recovery") {
              setShowRecoveryPanel((isVisible) => !isVisible);
              setIsSidebarOpen(false);
              return;
            }
            setActiveSection(section);
            setActiveCategory("");
            setShowRecoveryPanel(false);
            setIsSidebarOpen(false);
          }}
          onToggleCollapsed={() => setIsSidebarCollapsed((isCollapsed) => !isCollapsed)}
          renderIcon={(name) => <SidebarIcon name={name} />}
          showRecoveryPanel={showRecoveryPanel}
          toolboxSidebarCategoryGroups={toolboxSidebarCategoryGroups}
          visibleSidebarAccounts={visibleSidebarAccounts}
        />

        {showRecoveryPanel ? (
          <RecentlyDeletedPanel
            archives={visibleRecoveryArchives}
            expandedArchiveIds={expandedRecoveryIds}
            onClose={() => setShowRecoveryPanel(false)}
            onDeleteTool={deleteSingleArchivedTool}
            onRestoreSelected={(selectedKeys) => restoreSelectedRecoveryTools(undefined, selectedKeys)}
            onRestoreTool={restoreSingleArchivedTool}
            onSearchChange={setRecoverySearch}
            onToggleArchive={toggleRecoveryGroup}
            onToggleTool={toggleRecoveryTool}
            searchValue={recoverySearch}
            selectedKeys={selectedRecoveryKeys}
            selectedVisibleKeys={selectedVisibleRecoveryKeys}
          />
        ) : null}

        <section
          ref={mainContentRef}
          className={
            (
              [
                "dashboard",
                "account",
                "providers",
                "tools",
                "linked",
                "billing",
                "watchlist",
                "favorites",
                "archive",
                "settings",
              ] as Section[]
            ).includes(activeSection)
              ? "main-content list-page-content"
              : "main-content"
          }
        >
          <DashboardPageHeader
            activeSection={activeSection}
            hasConfirmedCategories={hasConfirmedCategories}
            isDemoMode={isDemoMode}
            isPendingActionsExpanded={isPendingActionsExpanded}
            onAddAccount={openAddAccountModal}
            onAddTool={handleAddToolClick}
            onBackToLogins={() => setActiveSection("account")}
            onEditCategories={openEditCategoryModal}
            onEditProviders={() => setActiveSection("providers")}
            onOpenPresets={openPresetToolPicker}
            onReseedDemo={reseedDemoWorkspace}
            onResetTools={openResetToolsFlow}
            onTogglePendingActions={() => setIsPendingActionsExpanded((isExpanded) => !isExpanded)}
            pendingActionCount={pendingBillingActions.length}
            subtitle={subtitle}
            title={title}
          />

          {activeSection === "billing" && isPendingActionsExpanded && pendingBillingActions.length > 0 ? (
            <section aria-label="Pending billing actions" className="pending-actions-panel">
              <div className="pending-actions-panel-heading">
                <strong>Pending actions</strong>
                <span>Confirm the outcome without changing the original Billing History entry.</span>
              </div>
              <div className="pending-actions-list">
                {pendingBillingActions.map(({ accountLabel, entry, recordKey, tool }) => {
                  const isResolving = resolvingPendingActionId === entry.id;
                  return (
                    <article className="pending-action-row" key={`${recordKey}-${entry.id}`}>
                      <div className="pending-action-copy">
                        <div className="pending-action-title-row">
                          <strong>{entry.event === "Double Charged" ? "Double charged" : entry.event}</strong>
                          <span className="pending-action-status">Unresolved</span>
                        </div>
                        <span>
                          {displayToolName(tool?.name ?? "Tool")} · {accountLabel} · {billingHistoryDisplayDate(entry.date)} · Original entry stays unchanged
                        </span>
                      </div>
                      {isResolving ? (
                        <div className="pending-action-resolution">
                          {renderDropdown({
                            ariaLabel: `Resolution outcome for ${displayToolName(tool?.name ?? "Tool")} ${accountLabel}`,
                            className: "pending-action-outcome",
                            id: `pending-action-outcome-${entry.id}`,
                            onChange: (outcome) => setPendingResolutionOutcome(outcome as BillingHistoryEvent),
                            options: pendingResolutionOptions(entry).map((outcome) => ({
                              label: outcome,
                              value: outcome,
                            })),
                            value: pendingResolutionOutcome,
                          })}
                          <DateFieldControl
                            ariaLabel={`Resolution date for ${displayToolName(tool?.name ?? "Tool")} ${accountLabel}`}
                            className="pending-action-date"
                            onChange={setPendingResolutionDate}
                            value={pendingResolutionDate}
                          />
                          <button
                            className="btn-sm btn-sm-primary"
                            disabled={!pendingResolutionDate}
                            onClick={() => setPendingResolutionConfirmation({ entry, recordKey })}
                            type="button"
                          >
                            Confirm
                          </button>
                          <button className="btn-sm btn-sm-ghost" onClick={() => setResolvingPendingActionId("")} type="button">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button className="pending-action-resolve" onClick={() => startResolvingPendingAction(entry.id)} type="button">
                          Resolve
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}

          {activeSection === "account" ? (
            <LoginsView
              accountDataError={accountDataError}
              draggedAccountLogin={draggedAccountLogin}
              groupedAccounts={groupedAccounts}
              isLoadingAccounts={isLoadingAccounts}
              onAddAccount={openAddAccountModal}
              onCopyLogin={copyAccountLogin}
              onDragAccount={moveAccount}
              onDraggedAccountChange={setDraggedAccountLogin}
              onEditAccount={openEditAccountModal}
            />
          ) : activeSection === "providers" ? (
            <ProvidersView
              customProviderRows={customProviderRows}
              defaultProviderRows={defaultProviderRows}
              onAddLogins={openAddAccountModal}
              onEditProvider={openEditProviderModal}
            />
          ) : activeSection === "settings" ? (
            <SettingsView
              currentUserEmail={currentUserEmail}
              isSavingProfile={isSavingProfile}
              newPassword={newPassword}
              onNewPasswordChange={setNewPassword}
              onRemindersEnabledChange={(nextValue) => {
                setRemindersEnabled(nextValue);
                window.localStorage.setItem("ai-subprise-reminders-enabled", String(nextValue));
              }}
              onSaveNewPassword={saveNewPassword}
              onSettingsTabChange={setSettingsTab}
              onSignOut={signOut}
              profileError={profileError}
              profileMessage={profileMessage}
              reminderDaysDropdown={renderDropdown({
                id: "settings-reminder-days",
                onChange: (days) => {
                  setReminderDays(days);
                  window.localStorage.setItem("ai-subprise-reminder-days", days);
                },
                options: [3, 7, 14].map((days) => ({ label: `${days} days before`, value: String(days) })),
                value: reminderDays,
              })}
              remindersEnabled={remindersEnabled}
              settingsTab={settingsTab}
            />
          ) : activeSection === "dashboard" ? (
            <DashboardSummaryView
              accountCount={accountList.length}
              paidToolCount={paidToolCount}
              reminderDays={reminderDays}
              toolCount={toolsWithValidAccountLinks.length}
              trialToolCount={trialToolCount}
              trialsEndingSoon={trialsEndingSoon.map((trial) => ({
                accountLabel: trial.accountLabel,
                expiryDate: trial.expiryDate,
                toolId: trial.tool.id,
                toolName: trial.tool.name,
              }))}
              trialsNeedingConfirmation={trialsNeedingConfirmation.map((trial) => ({
                accountLabel: trial.accountLabel,
                toolId: trial.tool.id,
                toolName: trial.tool.name,
              }))}
            />
          ) : (
            <>
              {activeSection !== "billing" || !isPendingActionsExpanded || pendingBillingActions.length === 0 ? (
              <section className="table-section">
                {activeSection === "tools" || activeSection === "linked" || activeSection === "watchlist" || activeSection === "billing" || activeSection === "favorites" || activeSection === "archive" ? (
                  <ListPageToolbar
                    activeCategory={Boolean(activeCategory)}
                    activeSection={activeSection}
                    billingView={selectedBillingView}
                    linkedPlanFilter={renderDropdown({
                      ariaLabel: "Filter linked tools by plan",
                      className: "linked-plan-filter",
                      id: "linked-plan-filter",
                      onChange: (nextPlan) => setLinkedPlanFilter(nextPlan as LinkedPlanFilter),
                      options: (["All", "Paid", "Trial", "Free"] as LinkedPlanFilter[]).map((plan) => ({
                        label: `Plan: ${plan}`,
                        value: plan,
                      })),
                      value: linkedPlanFilter,
                    })}
                    onBillingViewChange={setSelectedBillingView}
                    onSearchQueryChange={setActiveToolSearchQuery}
                    onToolSortChange={setSelectedToolSort}
                    searchQuery={activeToolSearchQuery}
                    selectedToolSort={selectedToolSort}
                    toolSortOptions={availableToolSortOptions}
                  />
                ) : null}

                {toolDataError ? (
                  <div className="data-state-message error" role="alert">
                    {toolDataError}
                  </div>
                ) : null}

                {(activeSection === "tools" || activeSection === "watchlist" || activeSection === "archive") && selectedVisibleToolIds.length > 0 ? (
                  <BulkToolActions
                    isArchiveSection={activeSection === "archive"}
                    onArchive={() => archiveToolIds(selectedVisibleToolIds)}
                    onClear={clearToolSelection}
                    onDelete={() => {
                      if (activeSection === "archive") {
                        permanentlyDeleteToolIds(selectedVisibleToolIds);
                        return;
                      }
                      deleteToolIds(selectedVisibleToolIds);
                    }}
                    selectedCount={selectedVisibleToolIds.length}
                  />
                ) : null}

                {activeSection === "billing" ? (
                  <div className="account-table tool-database tool-database-billing tool-database-flat">
                    <BillingView
                      billingMonthLabel={billingMonthLabel}
                      billingRows={billingRows}
                      billingSearchTerm={billingSearchTerm}
                      hasBillingRecords={allBillingRows.length > 0}
                      isLoadingTools={isLoadingTools}
                      onClearSearch={() => setBillingSearch("")}
                      onLinkAccount={() => openLinkToolModal()}
                      renderBillingRow={renderBillingRow}
                      selectedBillingView={selectedBillingView}
                    />
                  </div>
                ) : (
                  <AIToolboxView
                      activeCategory={activeCategory}
                      areAllVisibleToolsSelected={areAllVisibleToolsSelected}
                      emptyBody={
                        activeSection === "tools" ? (
                          toolboxEmptyState.body
                        ) : activeSection === "linked" ? (
                          linkedEmptyState.body
                        ) : toolSearchTerm ? (
                          <button className="inline-text-link" onClick={() => setActiveToolSearchQuery("")} type="button">
                            Clear search
                          </button>
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
                        )
                      }
                      emptyTitle={
                        activeSection === "tools"
                          ? toolboxEmptyState.title
                          : activeSection === "linked"
                            ? linkedEmptyState.title
                            : activeSection === "watchlist"
                              ? totalWatchlistToolCount === 0
                                ? "No watchlist tools yet"
                                : toolSearchTerm
                                  ? `No watchlist tools match '${toolSearchTerm}'`
                                  : "No watchlist tools here yet"
                              : activeSection === "favorites"
                                ? totalFavouriteToolCount === 0
                                  ? "No favourites yet"
                                  : toolSearchTerm
                                    ? `No favourites match '${toolSearchTerm}'`
                                    : "No favourites here yet"
                                : activeSection === "archive"
                                  ? totalArchivedToolCount === 0
                                    ? "No archived tools yet"
                                    : toolSearchTerm
                                      ? `No archived tools match '${toolSearchTerm}'`
                                      : "No archived tools here yet"
                                  : "No tools yet"
                      }
                      groupedEmptyBody={toolboxEmptyState.body}
                      groupedEmptyTitle={toolboxEmptyState.title}
                      groupedToolCategories={groupedToolCategories}
                      isGroupedView={
                        (activeSection === "tools" || activeSection === "linked" || activeSection === "watchlist") &&
                        workspaceCategories.length > 0 &&
                        !activeCategory &&
                        selectedToolSort === "Category" &&
                        (activeSection === "tools"
                          ? totalToolboxCount > 0
                          : activeSection === "linked"
                            ? totalLinkedToolCount > 0
                            : visibleTools.length > 0)
                      }
                      isLoadingTools={isLoadingTools}
                      renderToolCategoryGroup={renderToolCategoryGroup}
                      renderToolRow={renderToolRow}
                      section={activeSection}
                      selectedToolSort={selectedToolSort}
                      toggleVisibleToolSelection={toggleVisibleToolSelection}
                      visibleTools={visibleTools}
                  />
                )}
              </section>
              ) : null}
            </>
          )}
        </section>
      </div>

      {billingHistoryTarget ? (
        <BillingHistoryPanel
          historyEntries={billingHistorySections}
          onClose={() => setBillingHistoryTarget(null)}
          onUpdateNote={updateBillingHistoryNote}
          selectedToolAccount={billingHistoryTarget}
          toolName={billingHistoryToolName}
        />
      ) : null}

      <CategorySetupModals
        categoryDescriptions={categoryDescriptions}
        defaultToolCategories={defaultToolCategories}
        onChooseRole={chooseRoleAndPreview}
        onCloseCategoryGuide={() => setShowCategoryInfoModal(false)}
        onCloseCategoryPreview={() => setShowCategoryPreviewModal(false)}
        onCloseRoleQuestion={() => setShowRoleQuestionModal(false)}
        onContinueSelecting={() => setShowCategorySelectionWarning(false)}
        onOpenCategoryGuide={() => setShowCategoryInfoModal(true)}
        onSaveRoleCategories={saveRoleCategories}
        onSwitchPreviewRole={switchPreviewRole}
        onTogglePreviewCategory={togglePreviewCategory}
        roleCategoryMap={roleCategoryMap}
        roleOptions={roleOptions}
        roleQuestionChoice={roleQuestionChoice}
        selectedRole={selectedRole}
        selectedRoleCategories={selectedRoleCategories}
        showCategoryGuide={showCategoryInfoModal}
        showCategoryPreview={showCategoryPreviewModal}
        showCategorySelectionWarning={showCategorySelectionWarning}
        showRoleQuestion={showRoleQuestionModal}
      />

      {showEditCategoryModal && (
        <>
          <EditCategoryModal
            categoryDeleteWarning={categoryDeleteWarning}
            categoryDiscardWarning={categoryDiscardWarning}
            categoryDrafts={categoryDrafts}
            newCategoryName={newCategoryName}
            onAddCategory={addCategoryDraft}
            onCancelDelete={() => setCategoryDeleteWarning(null)}
            onCancelDiscard={() => setCategoryDiscardWarning(false)}
            onConfirmDelete={confirmCategoryDraftDelete}
            onDeleteCategory={deleteCategoryDraft}
            onDiscard={discardCategoryDrafts}
            onMoveCategory={moveCategoryDraft}
            onNewCategoryNameChange={(value) => setNewCategoryName(formatNickname(value))}
            onRequestClose={requestCloseEditCategoryModal}
            onSave={saveEditedCategories}
            onUpdateCategory={updateCategoryDraft}
          />
        </>
      )}

      <ResetAIToolsModals
        archiveToolCount={archiveToolCount(toolResetArchives)}
        onCancelArchiveWarning={() => setShowResetArchiveWarning(false)}
        onCancelDanger={() => {
          setPendingResetMode(null);
          setShowResetDangerModal(false);
        }}
        onCloseTypeModal={() => setShowResetTypeModal(false)}
        onConfirmDanger={confirmPendingReset}
        onContinueArchiveWarning={continueResetAfterArchiveWarning}
        onRequestReset={requestResetConfirmation}
        pendingResetMode={pendingResetMode}
        showArchiveWarning={showResetArchiveWarning}
        showDangerModal={showResetDangerModal}
        showTypeModal={showResetTypeModal}
        trashIcon={<TrashIconPaths />}
      />

      <DashboardConfirmationModals
        pendingResolutionConfirmation={pendingResolutionConfirmation ? {
          originalEvent: pendingResolutionConfirmation.entry.event,
          title: `Mark as ${pendingResolutionOutcome}, dated ${billingHistoryDisplayDate(pendingResolutionDate)}?`,
        } : null}
        showCreateAccountModal={showCreateAccountModal}
        showPresetSelectionWarning={showPresetSelectionWarning}
        toolStateConfirmation={confirmToolStateChange ? {
          action: confirmToolStateChange.action,
          toolName: confirmToolStateChange.tool.name,
        } : null}
        watchlistMoveToolName={watchlistMoveTool?.name ?? null}
        onClosePendingResolution={() => setPendingResolutionConfirmation(null)}
        onClosePresetSelectionWarning={() => setShowPresetSelectionWarning(false)}
        onCloseToolStateConfirmation={() => setConfirmToolStateChange(null)}
        onCloseWatchlistMove={() => setWatchlistMoveTool(null)}
        onConfirmPendingResolution={() => {
          if (pendingResolutionConfirmation) {
            confirmPendingActionResolution(
              pendingResolutionConfirmation.recordKey,
              pendingResolutionConfirmation.entry,
            );
          }
        }}
        onConfirmToolStateChange={confirmPendingToolStateChange}
        onConfirmWatchlistMove={confirmMoveWatchlistToolToLinked}
        onDismissCreateAccount={dismissCreateAccountModal}
        onOpenAccountSetup={openAccountSetup}
      />

      {showAddAccountModal ? (
        <AccountModal
          accountDataError={accountDataError}
          accounts={accountList}
          colourOptions={colourOptions}
          customProviderOption={customProviderOption}
          customProviders={customProviders}
          defaultProviders={defaultProviders}
          editingAccount={editingAccount}
          formatNickname={formatNickname}
          isSaving={isSavingAccount}
          nicknameMaxLength={accountNicknameMaxLength}
          onClose={() => {
            setEditingAccount(null);
            setShowAddAccountModal(false);
          }}
          onDelete={() => {
            if (!editingAccount) return;
            setShowAddAccountModal(false);
            setDeletingAccount(editingAccount);
          }}
          onSave={saveAccount}
          trashIcon={<TrashIconPaths />}
        />
      ) : null}

      {accountToast ? (
        <div className="app-toast app-toast-success" role="status">
          <svg aria-hidden="true" className="toast-success-check" fill="none" height="16" viewBox="0 0 24 24" width="16">
            <path d="m5 12 4 4L19 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
          <span>{accountToast}</span>
        </div>
      ) : null}

      {showPresetToolPicker ? (
        <PresetToolPickerModal
          expandedCategoryIds={expandedPresetCategories}
          isSaving={isSavingTool}
          normalizeCategory={normaliseToolCategory}
          onClose={() => setShowPresetToolPicker(false)}
          onDone={() => void savePresetToolSelection()}
          onExpandCategory={(categoryId) =>
            setExpandedPresetCategories((currentCategories) => [...currentCategories, categoryId])
          }
          onToggleShowAllCategories={() => setShowAllPresetCategories((showAll) => !showAll)}
          onToggleTool={togglePresetTool}
          selectedCategoryLabels={workspaceCategories}
          selectedRole={selectedRole}
          selectedRoleCategoryLabels={selectedRoleCategories}
          selectedToolNames={selectedPresetToolNames}
          showAllCategories={showAllPresetCategories}
          tools={toolList}
        />
      ) : null}

      {showAddToolModal ? (
        <AIToolModal
          archiveIcon={<ArchiveBoxIconPaths />}
          category={toolCategory}
          categoryOptions={toolCategoryOptions}
          categoryRequiredError={toolCategoryRequiredError}
          customCategoryOption={customCategoryOption}
          isCustomCategoryMode={isCustomCategoryMode}
          isEditing={Boolean(editingTool)}
          isSaving={isSavingTool}
          name={toolName}
          nameDuplicateError={toolNameDuplicateError}
          nameInputRef={toolNameInputRef}
          nameRequiredError={toolNameRequiredError}
          onArchive={archiveEditingTool}
          onCategoryChange={(nextCategory) => {
            if (!isCustomCategoryMode && nextCategory === customCategoryOption) {
              setIsCustomCategoryMode(true);
              setToolCategory("");
              return;
            }

            setToolCategory(isCustomCategoryMode ? formatNickname(nextCategory) : nextCategory);
          }}
          onClose={() => {
            setEditingTool(null);
            setShowAddToolModal(false);
          }}
          onDelete={deleteEditingTool}
          onNameChange={(nextName) => setToolName(displayToolName(nextName))}
          onSave={saveTool}
          onUrlChange={setToolUrl}
          renderDropdown={renderDropdown}
          toolDataError={toolDataError}
          trashIcon={<TrashIconPaths />}
          url={toolUrl}
        />
      ) : null}

      {showLinkToolModal ? (
        <LinkAIToolModal
          blocks={linkToolAccountBlocks}
          closeModal={closeLinkToolModal}
          DateFieldControl={DateFieldControl}
          defaultPlanForTool={() => defaultLinkPlanForTool(selectedLinkTool)}
          displayToolName={displayToolName}
          duplicateAccountLabels={duplicateLinkAccountLabels}
          filteredToolOptions={filteredLinkToolOptions}
          formatPlanName={formatNickname}
          hasSubmitted={hasSubmittedLinkToolForm}
          isLocked={isLinkToolLocked}
          isPickerOpen={isLinkToolPickerOpen}
          isPlanAllowedForTool={(plan) => isPlanAllowedForTool(selectedLinkTool, plan)}
          linkBillingTypeOptions={linkBillingTypeOptions}
          linkToolId={linkToolId}
          openAddToolModal={openAddToolModal}
          orderedAccountOptions={orderedAccountOptions}
          remainingAccountOptions={remainingLinkAccountOptions}
          renderDropdown={renderDropdown}
          renderMultiSelectDropdown={renderMultiSelectDropdown}
          renderPlanSelector={(plan, onChange) => renderPlanSelector(plan, onChange, selectedLinkTool)}
          searchQuery={linkToolSearchQuery}
          selectedTool={selectedLinkTool}
          setBlocks={setLinkToolAccountBlocks}
          setIsPickerOpen={setIsLinkToolPickerOpen}
          setLinkToolId={setLinkToolId}
          setOpenDropdownId={setOpenDropdownId}
          setSearchQuery={setLinkToolSearchQuery}
          submit={saveToolLink}
          toggleBillingTypeSelection={toggleBillingTypeSelection}
          toolInitials={toolInitials}
        />
      ) : null}

      {managingLink && managedTool ? (
        <ToolDetailModal
          accountTagClass={(accountLabel) => accountTag(accountLabel, accountList)}
          drafts={orderedToolDetailDrafts}
          formatPlanName={formatNickname}
          hasUnsavedChanges={hasUnsavedToolDetailChanges}
          onAddAccount={addToolDetailAccountDraft}
          onArchive={archiveManagedLinkTool}
          onClose={closeManageAccountModal}
          onSave={() => saveAllToolDetailAccounts(managedTool, orderedToolDetailDrafts)}
          onUnlink={(draft) => {
            const draftId = draft.draftId ?? draft.accountLabel;
            setToolDetailDrafts((current) => {
              const next = { ...current };
              delete next[draftId];
              return next;
            });
          }}
          onUpdateDraft={updateToolDetailDraft}
          renderAccountSelector={(draft) => {
            const draftId = draft.draftId ?? draft.accountLabel;
            const selectedByOtherDrafts = new Set(
              orderedToolDetailDrafts
                .filter((candidate) => (candidate.draftId ?? candidate.accountLabel) !== draftId)
                .map((candidate) => candidate.accountLabel)
                .filter(Boolean),
            );
            return renderDropdown({
              className: "modal-dropdown field-dropdown",
              id: `detail-account-${managedTool.id}-${draftId}`,
              onChange: (accountLabel) => updateToolDetailDraft(draftId, { accountLabel }),
              options: orderedAccountOptions.map((option) => ({
                ...option,
                disabled: selectedByOtherDrafts.has(option.value),
              })),
              placeholder: "Select account",
              value: draft.accountLabel,
            });
          }}
          renderBillingTypeSelector={(draft) => renderMultiSelectDropdown({
            className: "modal-dropdown field-dropdown",
            id: `detail-billing-${managedTool.id}-${draft.draftId ?? draft.accountLabel}`,
            onChange: (nextBillingTypes) => updateToolDetailDraft(draft.draftId ?? draft.accountLabel, {
              billingType: nextBillingTypes.join(", "),
              billingAmounts: nextBillingTypes.map((billingType) =>
                draft.billingAmounts.find((entry) => entry.billingType === billingType) ?? {
                  amount: "",
                  billingType,
                  currency: defaultCurrency,
                  id: billingAmountId(),
                }),
            }),
            options: billingTypeOptions.map((option) => ({
              ...option,
              label: option.value === "One-time"
                ? "One-time payment"
                : option.value === "Top-up"
                  ? "Top-up credit"
                  : option.label,
            })),
            placeholder: "Select billing type",
            toggleSelection: toggleBillingTypeSelection,
            values: draft.billingType ? draft.billingType.split(", ") : [],
          })}
          renderCurrencySelector={(draft, billingAmount) => renderDropdown({
            ariaLabel: `${draft.accountLabel} ${billingAmount.billingType} currency`,
            className: "billing-currency-dropdown field-dropdown",
            id: `detail-currency-${managedTool.id}-${draft.draftId ?? draft.accountLabel}-${billingAmount.billingType}`,
            onChange: (currency) => updateToolDetailDraft(draft.draftId ?? draft.accountLabel, {
              billingAmounts: draft.billingAmounts.map((entry) => (
                entry.billingType === billingAmount.billingType ? { ...entry, currency } : entry
              )),
            }),
            options: currencyOptions,
            value: billingAmount.currency,
          })}
          renderDateField={(ariaLabel, value, onChange) => (
            <DateFieldControl className="field-input" ariaLabel={ariaLabel} onChange={onChange} value={value} />
          )}
          renderPlanSelector={(value, onChange) => renderPlanSelector(value, onChange, managedTool)}
          renderStatusSelector={(draft) => renderDropdown({
            className: "modal-dropdown field-dropdown",
            id: `detail-status-${managedTool.id}-${draft.draftId ?? draft.accountLabel}`,
            onChange: (status) => updateToolDetailDraft(draft.draftId ?? draft.accountLabel, { status: status as ManageStatus }),
            options: (["Active", "On a Break", "Goodbye"] as ManageStatus[]).map((status) => ({ label: status, value: status })),
            value: draft.status,
          })}
          tool={{
            id: managedTool.id,
            initials: toolInitials(managedTool.name),
            logoBg: managedTool.logoBg,
            name: displayToolName(managedTool.name),
          }}
        />
      ) : null}

      <ProviderManagementModals
        deletingProvider={deletingProvider}
        editingProvider={editingProvider}
        providerName={providerName}
        trashIcon={<TrashIconPaths />}
        onCancelDelete={() => setDeletingProvider(null)}
        onCloseEdit={() => {
          setEditingProvider(null);
          setProviderName("");
        }}
        onConfirmDelete={deleteProvider}
        onProviderNameChange={(value) => setProviderName(formatNickname(value))}
        onRequestDelete={(provider) => {
          setDeletingProvider(provider);
          setEditingProvider(null);
        }}
        onSaveProvider={saveProviderName}
      />

      {deletingAccount ? (
        <DeleteAccountModal
          accountLabel={deletingAccount.label}
          error={accountDataError}
          isDeleting={isSavingAccount}
          trashIcon={<TrashIconPaths />}
          onCancel={() => {
            setDeletingAccount(null);
            setEditingAccount(null);
          }}
          onConfirm={confirmDeleteAccount}
        />
      ) : null}

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
