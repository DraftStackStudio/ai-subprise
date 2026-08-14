import Link from "next/link";

const navigation = [
  { href: "/dashboard", icon: "dashboard", label: "Dashboard" },
  { href: "/dashboard?view=account", icon: "user", label: "Logins" },
  { href: "/dashboard?view=tools", icon: "list", label: "AI Toolbox" },
  { href: "/dashboard?view=linked", icon: "link", label: "Linked" },
  { href: "/dashboard?view=billing", icon: "billing", label: "Billing" },
  { href: "/dashboard?view=watchlist", icon: "eye", label: "Watchlist" },
  { href: "/dashboard?view=favorites", icon: "star", label: "Favourites" },
  { href: "/dashboard?view=archive", icon: "archive", label: "Archived" },
];

function PricingSidebarIcon({ name }: { name: string }) {
  return (
    <svg aria-hidden="true" className="sidebar-icon" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
      {name === "dashboard" ? <><circle cx="12" cy="12" r="7.5" /><path d="M12 4.5v3M19.5 12h-3M12 19.5v-3M4.5 12h3" /><circle cx="12" cy="12" r="3.5" /></> : null}
      {name === "user" ? <><circle cx="12" cy="8" r="3" /><path d="M5.5 19c.8-3.5 3-5.2 6.5-5.2s5.7 1.7 6.5 5.2" /></> : null}
      {name === "list" ? <><path d="M7 7h11M7 12h11M7 17h8" /><circle cx="4" cy="7" r=".6" fill="currentColor" /><circle cx="4" cy="12" r=".6" fill="currentColor" /><circle cx="4" cy="17" r=".6" fill="currentColor" /></> : null}
      {name === "link" ? <><path d="m9.5 14.5 5-5" /><path d="m10.5 7.5 1.5-1.5a4 4 0 0 1 5.7 5.7l-1.5 1.5M13.5 16.5 12 18a4 4 0 0 1-5.7-5.7l1.5-1.5" /></> : null}
      {name === "billing" ? <><rect height="12" rx="2" width="15" x="4.5" y="6" /><path d="M4.5 10h15M8 14h3" /></> : null}
      {name === "eye" ? <><path d="M4 12s2.8-5 8-5 8 5 8 5-2.8 5-8 5-8-5-8-5Z" /><circle cx="12" cy="12" r="2.2" /></> : null}
      {name === "star" ? <path d="m12 4.5 2.3 4.7 5.2.7-3.8 3.7.9 5.2-4.6-2.4-4.6 2.4.9-5.2-3.8-3.7 5.2-.7L12 4.5Z" /> : null}
      {name === "archive" ? <><rect height="10" rx="1.5" width="11" x="6.5" y="9" /><path d="M5.5 6h13v3h-13zM10 13h4" /></> : null}
      {name === "trash" ? <><path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" /></> : null}
      {name === "settings" ? <><circle cx="12" cy="12" r="3" /><path d="m12 3 .8 2.2 2 .8 2.1-1 2.1 2.1-1 2.1.8 2 .2.8 2.2.8 2-.8 2.1 1 2.1-2.1-1-2.1.8-2-.8-2.2h-3l-.8 2.2-2 .8-2.1-1-2.1-2.1 1-2.1-.8-2L3 12l.8-2.2 2-.8-1-2.1 2.1-2.1 2.1 1 2-.8.8-2.2Z" /></> : null}
    </svg>
  );
}

export default function PricingSidebar() {
  return (
    <aside aria-label="Dashboard navigation" className="sidebar">
      <div className="sidebar-header">
        <Link className="sidebar-logo" href="/">
          <span className="sidebar-logo-icon">AI</span>
          <span className="sidebar-logo-name">AI Sub<span>prise</span></span>
        </Link>
      </div>
      <nav aria-label="Workspace" className="sidebar-nav">
        <div className="nav-label">Workspace</div>
        {navigation.map((item) => (
          <Link className="nav-item" href={item.href} key={item.label}>
            <PricingSidebarIcon name={item.icon} />
            {item.label}
          </Link>
        ))}
      </nav>
      <nav aria-label="Utilities" className="sidebar-utility">
        <Link className="nav-item" href="/dashboard?view=recovery"><PricingSidebarIcon name="trash" />Recently Deleted</Link>
        <Link aria-current="page" className="nav-item active" href="/dashboard?view=account"><PricingSidebarIcon name="settings" />Settings</Link>
      </nav>
    </aside>
  );
}
