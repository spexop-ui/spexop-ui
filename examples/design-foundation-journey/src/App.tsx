import { useEffect, useState, type FormEvent, type ReactNode } from "react";
type Page = "overview" | "projects" | "settings";
const pages: Page[] = ["overview", "projects", "settings"];
const title = {
  overview: "Overview",
  projects: "Projects",
  settings: "Workspace settings",
};
const readPage = (): Page =>
  pages.includes(location.hash.slice(1) as Page)
    ? (location.hash.slice(1) as Page)
    : "overview";
const projects = [
  {
    name: "Community website",
    client: "Harbor Collective",
    stage: "In progress",
    due: "28 Oct",
    progress: 65,
  },
  {
    name: "Client portal",
    client: "North Studio",
    stage: "Review",
    due: "31 Oct",
    progress: 90,
  },
  {
    name: "Design audit",
    client: "Local Library",
    stage: "Planning",
    due: "04 Nov",
    progress: 20,
  },
];
function Panel({
  children,
  className = "",
  tone = "default",
}: {
  children: ReactNode;
  className?: string;
  tone?: "default" | "muted";
}) {
  return (
    <section
      className={`panel p-4 ${tone === "muted" ? "bg-surface-secondary" : "bg-surface"} ${className}`}
    >
      {children}
    </section>
  );
}
export default function App() {
  const [page, setPage] = useState<Page>(readPage),
    [mode, setMode] = useState<"light" | "dark">("light"),
    [menu, setMenu] = useState(false),
    [filter, setFilter] = useState("All"),
    [saved, setSaved] = useState(false);
  const [profile, setProfile] = useState({
    workspace: "",
    email: "",
    notes: "",
    type: "Website",
    reminders: true,
  });
  useEffect(() => {
    const update = () => {
      setPage(readPage());
      setMenu(false);
    };
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = mode;
  }, [mode]);
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setProfile({
      workspace: String(values.get("workspace")),
      email: String(values.get("email")),
      notes: String(values.get("notes")),
      type: String(values.get("type")),
      reminders: values.has("reminders"),
    });
    setSaved(true);
  }
  return (
    <div className="shell">
      <a className="skip-link" href="#content">
        Skip to content
      </a>
      <header className="site-header">
        <a className="wordmark" href="#overview">
          Fieldwork<span>Solo workspace</span>
        </a>
        <div className="header-actions">
          <span className="fixture-label">Acceptance fixture</span>
          <button
            className="secondary"
            onClick={() => setMode(mode === "light" ? "dark" : "light")}
            aria-label={`Current theme ${mode}. Switch to ${mode === "light" ? "dark" : "light"}`}
          >
            {mode === "light" ? "Dark theme" : "Light theme"}
          </button>
          <button
            className="mobile-toggle secondary"
            aria-expanded={menu}
            aria-controls="navigation"
            onClick={() => setMenu(!menu)}
          >
            Menu
          </button>
        </div>
      </header>
      <div className="workspace">
        <nav
          id="navigation"
          aria-label="Main navigation"
          className={menu ? "navigation open" : "navigation"}
        >
          {pages.map((p) => (
            <a
              key={p}
              href={`#${p}`}
              aria-current={page === p ? "page" : undefined}
            >
              {title[p]}
            </a>
          ))}
          <p className="nav-note">
            One workspace.
            <br />A consistent foundation.
          </p>
        </nav>
        <main id="content" tabIndex={-1} className="content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">Workspace / {title[page]}</p>
              <h1>{title[page]}</h1>
              <p className="text-text-muted">
                Your work, clients and preferences in one place.
              </p>
            </div>
            <a className="secondary" href="#settings">
              Edit workspace
            </a>
          </div>
          {page === "overview" && (
            <>
              <div className="stats">
                <Panel>
                  <p className="text-text-muted">Active projects</p>
                  <strong className="metric">3</strong>
                  <p>Across three clients</p>
                </Panel>
                <Panel>
                  <p className="text-text-muted">Due this week</p>
                  <strong className="metric">2</strong>
                  <p>Next delivery: 28 Oct</p>
                </Panel>
                <Panel>
                  <p className="text-text-muted">Focus time</p>
                  <strong className="metric">18 h</strong>
                  <p>Planned for this week</p>
                </Panel>
              </div>
              <div className="two-column">
                <Panel>
                  <h2>Next milestones</h2>
                  <ul className="milestones">
                    {projects.map((p) => (
                      <li key={p.name}>
                        <div>
                          <strong>{p.name}</strong>
                          <p className="text-text-muted">{p.client}</p>
                        </div>
                        <span>{p.due}</span>
                      </li>
                    ))}
                  </ul>
                  <a className="text-link" href="#projects">
                    View all projects →
                  </a>
                </Panel>
                <Panel tone="muted">
                  <h2>Weekly focus</h2>
                  <p>
                    Finish the community website handoff and collect feedback on
                    the client portal.
                  </p>
                  <p className="mt-4">
                    Keep Wednesday afternoon free for the design audit.
                  </p>
                  <div className="drift-example">
                    <span
                      style={{
                        padding: 13,
                        backgroundColor: "#c026d3",
                        color: "#fff",
                      }}
                    >
                      Priority
                    </span>
                    <small>Intentional hardcoded-style probe</small>
                  </div>
                </Panel>
              </div>
            </>
          )}
          {page === "projects" && (
            <>
              <div className="filter-row">
                <label htmlFor="status-filter">Status</label>
                <select
                  id="status-filter"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  {["All", "In progress", "Review", "Planning"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <span role="status">
                  {
                    projects.filter(
                      (p) => filter === "All" || p.stage === filter,
                    ).length
                  }{" "}
                  projects
                </span>
              </div>
              <div className="project-grid">
                {projects
                  .filter((p) => filter === "All" || p.stage === filter)
                  .map((p) => (
                    <Panel key={p.name}>
                      <div className="card-top">
                        <span className="badge">{p.stage}</span>
                        <span className="text-text-muted">{p.due}</span>
                      </div>
                      <h2>{p.name}</h2>
                      <p>{p.client}</p>
                      <label className="progress-label">
                        Completion{" "}
                        <progress value={p.progress} max={100}>
                          {p.progress}%
                        </progress>
                        <span>{p.progress}%</span>
                      </label>
                      <a className="text-link" href="#settings">
                        Workspace details →
                      </a>
                    </Panel>
                  ))}
              </div>
            </>
          )}
          {page === "settings" && (
            <Panel className="settings-panel">
              <h2>Workspace profile</h2>
              <p className="text-text-muted">
                This form saves locally for the acceptance session only.
              </p>
              <form onSubmit={save} onChange={() => setSaved(false)}>
                <label htmlFor="workspace-name">Workspace name</label>
                <input
                  id="workspace-name"
                  name="workspace"
                  defaultValue={profile.workspace}
                  required
                  minLength={2}
                  placeholder="Your workspace"
                />
                <label htmlFor="contact-email">Contact email</label>
                <input
                  id="contact-email"
                  name="email"
                  defaultValue={profile.email}
                  type="email"
                  required
                  placeholder="you@example.com"
                />
                <label htmlFor="project-type">Default project type</label>
                <select
                  id="project-type"
                  name="type"
                  defaultValue={profile.type}
                >
                  <option>Website</option>
                  <option>Product design</option>
                  <option>Audit</option>
                </select>
                <label htmlFor="workspace-notes">Notes</label>
                <textarea
                  id="workspace-notes"
                  name="notes"
                  defaultValue={profile.notes}
                  rows={3}
                  placeholder="A short note for your future self"
                />
                <label className="check-label">
                  <input
                    type="checkbox"
                    name="reminders"
                    defaultChecked={profile.reminders}
                  />{" "}
                  Show weekly planning reminders
                </label>
                <button className="primary" type="submit">
                  Save workspace
                </button>
                <p role="status" className="save-status">
                  {saved
                    ? "Workspace saved for this session."
                    : "Fields marked by the browser are required."}
                </p>
              </form>
            </Panel>
          )}
          <footer>
            Theme generated by @spexop/theme · Source mapping is manual · {mode}{" "}
            mode
          </footer>
        </main>
      </div>
    </div>
  );
}
