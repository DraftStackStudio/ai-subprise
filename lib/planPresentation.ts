export function planPillTone(plan: string) {
  if (plan === "Active" || plan === "Paid") return "status-running";
  if (plan === "Trial") return "status-trial";
  if (plan === "Free" || plan === "Free Tier") return "status-free";
  return "status-muted";
}
