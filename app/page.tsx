function FeatureIcon({ index }: { index: number }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      {index === 0 ? <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></> : null}
      {index === 1 ? <><circle cx="10" cy="8" r="3" /><path d="M4.5 19c.5-4 2.4-6 5.5-6 1.5 0 2.7.4 3.6 1.2" /><path d="m16 14 4 4-3 3-4-4v-3h3Z" /></> : null}
      {index === 2 ? <><path d="M8 6h12M8 12h12M8 18h12" /><circle cx="4.5" cy="6" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="18" r="1" /></> : null}
      {index === 3 ? <><path d="M9.5 14.5 14.5 9.5" /><path d="M10 7.5 12 5.5a4 4 0 0 1 5.7 5.7l-2 2" /><path d="m14 16.5-2 2a4 4 0 0 1-5.7-5.7l2-2" /></> : null}
      {index === 4 ? <><circle cx="12" cy="12" r="8" /><path d="M12 4v8l5.7 5.7" /><circle cx="12" cy="12" r="1.5" /></> : null}
      {index === 5 ? <><circle cx="10.5" cy="10.5" r="5.5" /><path d="m15 15 5 5M4 19h7M15 5h5" /></> : null}
      {index === 6 ? <><path d="m9 4 2 4.1 4.5.7-3.3 3.2.8 4.5L9 14.4l-4 2.1.8-4.5-3.3-3.2 4.5-.7L9 4Z" /><path d="M15 14h5v6h-7v-3" /></> : null}
      {index === 7 ? <><path d="M5 4h14v16H5z" /><path d="M8 8h8M8 12h8M8 16h5" /></> : null}
    </svg>
  );
}

export default function Home() {
  const steps = [
    {
      title: "Add your accounts",
      lines: [
        "Save every email or account you use.",
        "Give each one a nickname and a colour.",
        "Personal. Work. Dev. Label it your way.",
      ],
    },
    {
      title: "Add your AI tools",
      lines: [
        "Add every AI tool you use or have signed up for.",
        "Even the ones you signed up for and forgot about.",
        "No judgement. We counted ours too.",
      ],
    },
    {
      title: "Link them together",
      lines: [
        "Connect each tool to the account you used to sign up.",
        "One glance and you know exactly which one it was.",
        "Pick the right one. First try.",
      ],
    },
    {
      title: "Track your billing",
      lines: [
        "Track plan names, billing type, and next charge date for every paid tool.",
        "Nothing sneaks past you.",
      ],
    },
  ];

  const features = [
    {
      icon: "⌂",
      title: "Dashboard",
      copy: "See your tools, paid plans, and active trials in one glance.",
    },
    {
      icon: "●",
      title: "Logins",
      copy: "Give every account a nickname and colour, so you recognise it instantly.",
    },
    {
      icon: "□",
      title: "AI Toolbox",
      copy: "Keep your full list of AI tools in one place, including the ones you nearly forgot.",
    },
    {
      icon: "↔",
      title: "Linked",
      copy: "See exactly which account is tied to each tool. No guessing, no inbox hunting.",
    },
    {
      icon: "◐",
      title: "Billing",
      copy: "Plan name, billing type, amount, and next charge, tracked per tool.",
    },
    {
      icon: "⌕",
      title: "Watchlist",
      copy: "Tools you're considering, kept aside until you're ready to link them.",
    },
    {
      icon: "★",
      title: "Favourites and Archive",
      copy: "Pin daily tools. Archive experiments you are not ready to delete. Keep your workspace tidy without losing history.",
    },
    {
      icon: "✎",
      title: "Notes",
      copy: "Add a quick note to any tool. A reminder, a login quirk, a tip for future you. Small detail, big time saver.",
    },
  ];

  return (
    <main className="marketing-frame" data-theme="dark" data-dark-variant="cool">
      <section className="marketing-card" aria-label="AI Subprise landing page">
        <nav className="marketing-nav" aria-label="Main navigation">
          <a className="landing-logo compact-logo" href="/">
            <div className="landing-logo-icon">AI</div>
            <div className="landing-logo-name">AI Subprise</div>
          </a>
          <a className="btn-sm btn-sm-ghost" href="/login">Log in</a>
        </nav>

        <section className="marketing-hero">
          <div>
            <p className="marketing-kicker">Built for AI tool hoarders</p>
            <h1>Which email or account did you use again?</h1>
            <p>
              AI Subprise is the place to see every AI tool and the exact account you signed up with. No more guessing
              and stop cycling through your different email inboxes.
            </p>
            <div className="marketing-actions">
              <a className="btn-primary" href="/login?mode=signup">Get started</a>
              <a className="btn-outline" href="/dashboard?demo=1">Explore as guest</a>
            </div>
          </div>

          <div className="marketing-preview" aria-label="Dashboard preview">
            <div className="preview-topline">
              <span>Workspace</span>
              <strong>12 tools</strong>
            </div>
            <div className="preview-tags">
              <span className="email-tag tag-brown"><span className="tag-dot" />Personal</span>
              <span className="email-tag tag-teal"><span className="tag-dot" />Work</span>
              <span className="status-badge badge-paid">Paid</span>
              <span className="status-badge badge-trial">Trial</span>
            </div>
            <div className="preview-row">
              <span>ChatGPT</span>
              <small>Personal, Work</small>
            </div>
            <div className="preview-row">
              <span>Runway ML</span>
              <small>Testing trial</small>
            </div>
            <div className="preview-row">
              <span>Claude</span>
              <small>Work account</small>
            </div>
          </div>
        </section>

        <section className="marketing-section marketing-section-familiar">
          <p className="marketing-kicker">Sound Familiar?</p>
          <h2>
            You open an AI tool.
            <br />
            The login screen appears.
          </h2>
          <div className="story-copy">
            <p>
              And then you start thinking... Was it my Gmail? The work one? Or did I use GitHub for this one?
            </p>
            <p>
              You try one. Wrong. You try another. Still wrong. By the third attempt you are checking your inbox for a
              signup email that may or may not exist.
            </p>
            <p>
              The tab is still open. Your momentum is gone. And this is not even the first time this has happened.
            </p>
            <p>
              AI Subprise puts an end to the guessing game.
            </p>
          </div>
        </section>

        <section className="marketing-section marketing-section-steps">
          <p className="marketing-kicker">How It Fits Together</p>
          <div className="step-grid">
            {steps.map((step, index) => (
              <article className="step-card" key={step.title}>
                <span className="step-number">{String(index + 1).padStart(2, "0")}</span>
                <div className="step-content">
                  <h3>{step.title}</h3>
                  <p>
                    {step.lines.map((line) => <span key={line}>{line}</span>)}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="marketing-section marketing-section-inside">
          <p className="marketing-kicker">What's Inside</p>
          <div className="inside-grid">
            {features.slice(0, 6).map((feature, index) => (
              <article className="inside-card" key={feature.title}>
                <div className="inside-card-icon"><FeatureIcon index={index} /></div>
                <h3>{feature.title}</h3>
                <p>{feature.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="marketing-section final-marketing-section marketing-section-final">
          <p className="marketing-kicker">Ready to Stop Guessing?</p>
          <h2>
            Your accounts are sorted.
            <br />
            Your tools have a home.
          </h2>
          <p>
            The login screen is no longer a guessing game. Try AI Subprise today.
          </p>
          <div className="marketing-actions">
            <a className="btn-primary" href="/login?mode=signup">Create your account</a>
          </div>
          <p className="final-login-copy">Already have an account? <a href="/login">Log in</a></p>
        </section>
      </section>
    </main>
  );
}
