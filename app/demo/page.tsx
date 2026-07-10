import Link from "next/link";

export default function DemoPage() {
  return (
    <main className="landing-frame" data-theme="dark" data-dark-variant="cool">
      <div className="landing-inner">
        <div className="landing-logo">
          <div className="landing-logo-icon">AI</div>
          <div className="landing-logo-name">AI Subprise</div>
        </div>

        <section className="landing-card" aria-label="AI Subprise demo">
          <h1>Demo workspace</h1>
          <p>Explore the idea before creating your own account.</p>
          <Link className="btn-primary" href="/dashboard?demo=1">
            Open demo
          </Link>
          <Link className="btn-outline" href="/login">
            Create your account
          </Link>
        </section>
      </div>
    </main>
  );
}
