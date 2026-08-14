import { Suspense } from "react";
import { DashboardContent } from "@/app/dashboard/page";

export default function AccountsPage() {
  return <Suspense><DashboardContent forcedSection="accounts" /></Suspense>;
}
