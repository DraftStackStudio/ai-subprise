import type { ToolStatus } from "@/types/toolDetail";

export type LinkToolAccountBlock = {
  accountLabel: string;
  billingType: string;
  id: string;
  lastTopUpDate: string;
  nextChargeDate: string;
  plan: ToolStatus | "";
  planName: string;
  trialExpiryDate: string;
};

export type LinkToolDropdownOption = {
  description?: string;
  disabled?: boolean;
  label: string;
  tag?: string;
  value: string;
};

export type LinkToolItem = {
  accounts: string[];
  id: string;
  logoBg: string;
  name: string;
};
