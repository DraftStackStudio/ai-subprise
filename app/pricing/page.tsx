import PricingSidebar from "@/components/PricingSidebar";
import { pricingTiers } from "@/lib/pricingTiers";

export default function PricingPage() {
  return (
    <main className="app-shell" data-theme="dark" data-dark-variant="cool">
      <div className="dashboard-frame pricing-dashboard-frame">
        <PricingSidebar />
        <section className="main-content list-page-content pricing-dashboard-content">
          <header className="main-header">
            <div>
              <h1 className="main-title">Plans</h1>
              <p className="main-subtitle">Choose the plan that fits your AI stack.</p>
            </div>
          </header>

          <div className="pricing-page">
            <section className="pricing-intro">
              <h2>Keep every AI subscription under control.</h2>
              <p>Upgrade to Pro for complete billing visibility, renewal reminders, and room for every tool you use.</p>
            </section>

            <section className="pricing-grid" aria-label="AI Subprise pricing tiers">
              {pricingTiers.map((tier) => (
                <article className={tier.id === "pro" ? "pricing-tier is-featured" : "pricing-tier"} key={tier.id}>
                  <div>
                    <h3>{tier.name}</h3>
                    <p className="pricing-tier-price">{tier.price}</p>
                  </div>
                  <ul>
                    {tier.features.map((feature) => (
                      <li key={feature}><span aria-hidden="true">✓</span>{feature}</li>
                    ))}
                  </ul>
                  <a className={tier.id === "pro" ? "btn-primary pricing-tier-cta" : "btn-outline pricing-tier-cta"} href="/login?mode=signup">
                    Get started
                  </a>
                </article>
              ))}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
