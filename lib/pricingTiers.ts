export type PricingTier = {
  id: string;
  name: string;
  price: string;
  features: string[];
};

export const pricingTiers: PricingTier[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    features: [
      "Build your AI tool directory",
      "Link tools to your logins",
      "Track trials and watchlist tools",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "Coming soon",
    features: [
      "Everything in Free",
      "Track paid plans and billing dates",
      "Billing history and renewal reminders",
      "Unlimited AI tools and logins",
    ],
  },
];
