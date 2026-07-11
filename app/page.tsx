export default function Home() {
  const steps = [
    {
      title: "Add your accounts",
      copy: (
        <>
          Save every email or account you use. Give each one a nickname and a colour.
          <br />
          <br />
          Personal. Work. Dev. Label it your way.
        </>
      ),
    },
    {
      title: "Add your AI tools",
      copy: (
        <>
          Add every AI tool you use or have signed up for. Even the ones you signed up for and forgot about.
          <br />
          <br />
          No judgement. We counted ours too.
        </>
      ),
    },
    {
      title: "Check before you log in",
      copy: (
        <>
          Before you hit that login screen, open AI Subprise. Your directory tells you exactly which account belongs to
          which tool.
          <br />
          <br />
          Pick the right one. First try.
        </>
      ),
    },
  ];

  const features = [
    {
      icon: "⌂",
      title: "Dashboard",
      copy: "Your full picture, the moment you log in. See every tool, every account, and every status at a glance.",
    },
    {
      icon: "●",
      title: "Account Nicknames",
      copy: "Give every account a nickname that makes sense to you. Each one gets a colour so you can recognise it quickly across the app.",
    },
    {
      icon: "□",
      title: "AI Tool Directory",
      copy: "Add every AI tool you use, paid or free. Keep your full list in one place, including the ones you nearly forgot.",
    },
    {
      icon: "↔",
      title: "Linked Accounts",
      copy: "Each tool shows exactly which account you used to sign up. No guessing, no inbox hunting.",
    },
    {
      icon: "◐",
      title: "Free, Paid or Trial",
      copy: "Know the status of every tool you have. See what you are paying for, what is still on trial, and what is completely free.",
    },
    {
      icon: "⌕",
      title: "Search and Filter",
      copy: "Find any tool in seconds. Filter by account, status, category, or billing type. Your directory, your way.",
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
              <a className="btn-primary" href="/login">Get started</a>
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

        <section className="marketing-section">
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

        <section className="marketing-section">
          <p className="marketing-kicker">Simple by Design</p>
          <div className="step-grid">
            {steps.map((step, index) => (
              <article className="step-card" key={step.title}>
                <span>{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="marketing-section">
          <p className="marketing-kicker">What's Inside</p>
          <div className="inside-grid">
            {features.map((feature) => (
              <article className="inside-card" key={feature.title}>
                <span>{feature.icon}</span>
                <h3>{feature.title}</h3>
                <p>{feature.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="marketing-section final-marketing-section">
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
            <a className="btn-primary" href="/login">Get started</a>
            <a className="btn-outline" href="/dashboard?demo=1">Explore as guest</a>
          </div>
        </section>
      </section>
    </main>
  );
}
