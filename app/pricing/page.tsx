"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PricingSidebar from "@/components/PricingSidebar";
import { pricingTiers } from "@/lib/pricingTiers";
import { createClient } from "@/lib/supabase/client";

export default function PricingPage() {
  const supabase = useMemo(() => createClient(), []);
  const [isOnWaitlist, setIsOnWaitlist] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setIsOnWaitlist(data.user?.user_metadata.pro_waitlist === true));
  }, []);

  const joinWaitlist = async () => {
    if (isSaving || isOnWaitlist) return;
    setIsSaving(true);
    const { error } = await supabase.auth.updateUser({ data: { pro_waitlist: true } });
    setIsSaving(false);
    if (error) return;
    setIsOnWaitlist(true);
    setShowToast(true);
    window.setTimeout(() => setShowToast(false), 3200);
  };

  return (
    <main className="app-shell" data-theme="dark" data-dark-variant="cool">
      <div className="dashboard-frame pricing-dashboard-frame">
        <PricingSidebar />
        <section className="main-content list-page-content pricing-dashboard-content">
          <header className="main-header">
            <div><h1 className="main-title">Plans</h1><p className="main-subtitle">Choose the plan that fits your AI stack.</p></div>
            <div className="header-actions">
              <Link className="btn-sm btn-sm-ghost button-with-icon" href="/dashboard?view=settings">
                <svg aria-hidden="true" className="button-inline-icon" fill="none" viewBox="0 0 24 24"><path d="M19 12H5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /><path d="m12 19-7-7 7-7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>
                Back to Settings
              </Link>
            </div>
          </header>
          <div className="pricing-page">
            <section className="pricing-intro">
              <h2>Keep every AI subscription<br />under control.</h2>
              <p>Upgrade to Pro for complete billing visibility, renewal reminders, and room for every tool you use.</p>
            </section>
            <section className="pricing-grid" aria-label="AI Subprise pricing tiers">
              {pricingTiers.map((tier) => (
                <article className={tier.id === "pro" ? "pricing-tier is-featured" : "pricing-tier"} key={tier.id}>
                  <div><h3>{tier.name}</h3><p className="pricing-tier-price">{tier.price}</p></div>
                  <ul>{tier.features.map((feature) => <li key={feature}><span aria-hidden="true">✓</span>{feature}</li>)}</ul>
                  {tier.id === "pro" ? (
                    <button className="btn-primary pricing-tier-cta" disabled={isOnWaitlist || isSaving} onClick={joinWaitlist} type="button">{isOnWaitlist ? "You're on the list" : isSaving ? "Adding…" : "Notify me when Pro launches"}</button>
                  ) : <span className="btn-outline pricing-tier-cta pricing-current-plan">Current plan</span>}
                </article>
              ))}
            </section>
          </div>
          {showToast ? <div className="app-toast app-toast-success" role="status"><span aria-hidden="true" className="app-toast-check">✓</span><span>Added to Pro waitlist</span></div> : null}
        </section>
      </div>
    </main>
  );
}
