export const demoWorkspaceFixtureVersion = "1";

export const demoAccounts = [
  { id: "demo-login-gmail-personal", label: "Personal", provider: "Gmail", login: "aetan@gmail.com", tag: "tag-green", linked: 2 },
  { id: "demo-login-gmail-work", label: "Work", provider: "Gmail", login: "work@gmail.com", tag: "tag-purple", linked: 2 },
  { id: "demo-login-gmail-client", label: "Client", provider: "Gmail", login: "clientelXYZ@gmail.com", tag: "tag-pink", linked: 0 },
  { id: "demo-login-gmail-burner", label: "Burner", provider: "Gmail", login: "ietubnay@gmail.com", tag: "tag-orange", linked: 0 },
  { id: "demo-login-icloud-apple", label: "Apple", provider: "iCloud", login: "xxxxx@icloud.com", tag: "tag-gray", linked: 0 },
  { id: "demo-login-github-github", label: "Github", provider: "Github", login: "ayb-rtv", tag: "tag-orange", linked: 0 },
] as const;

export const demoToolLinks = [
  {
    toolName: "ChatGPT",
    accounts: [
      {
        accountLabel: "Personal",
        plan: "Paid",
        planName: "Plus",
        billingType: "Monthly",
        billingAmounts: [{ id: "039088f2-c8d3-4ba5-84a2-dc5faee1567b", billingType: "Monthly", currency: "USD", amount: "20.00" }],
        nextChargeDate: "2026-08-15",
        trialExpiryDate: "",
        status: "Active",
      },
      {
        accountLabel: "Work",
        plan: "Paid",
        planName: "Team",
        billingType: "Monthly, Top-up",
        billingAmounts: [
          { id: "20a2a577-9c61-4759-bcb6-26a742de8a8d", billingType: "Monthly", currency: "USD", amount: "30.00" },
          { id: "40ab16fc-02c8-46d1-9cd1-65781ff308b9", billingType: "Top-up", currency: "USD", amount: "8.00" },
        ],
        nextChargeDate: "2026-08-20",
        trialExpiryDate: "",
        status: "Active",
      },
    ],
  },
  {
    toolName: "Claude",
    accounts: [
      {
        accountLabel: "Personal",
        plan: "Trial",
        planName: "",
        billingType: "Monthly",
        billingAmounts: [],
        nextChargeDate: "",
        trialExpiryDate: "2026-07-31",
        status: "Active",
      },
      {
        accountLabel: "Work",
        plan: "Paid",
        planName: "Pro",
        billingType: "Monthly",
        billingAmounts: [{ id: "e8ce173e-592c-41a9-aab6-0f9e1930e4c5", billingType: "Monthly", currency: "USD", amount: "25.00" }],
        nextChargeDate: "2026-08-18",
        trialExpiryDate: "",
        status: "Active",
      },
    ],
  },
] as const;

export const demoManualBillingHistory = {
  toolName: "ChatGPT",
  accountLabel: "Work",
  entry: {
    amount: "5.00",
    billingType: "Top-up",
    currency: "USD",
    date: "2026-07-10",
    event: "Double Charged",
    id: "demo-manual-chatgpt-work-double-charge",
    note: "Manual test entry",
    planName: "Team",
    saved: true,
    source: "manual",
  },
} as const;
