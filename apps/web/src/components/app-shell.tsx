import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Runs', hint: 'Traces & trees', end: true },
  { to: '/compare', label: 'Compare', hint: 'Version diff', end: false },
];

export function AppShell() {
  return (
    <div className="shell">
      <div className="shell__bg" aria-hidden />
      <aside className="shell__sidebar">
        <div className="brand">
          <div className="brand__mark" aria-hidden>
            <span />
            <span />
            <span />
          </div>
          <div>
            <div className="brand__title">AgentTrace</div>
            <div className="brand__tag">Agent observability</div>
          </div>
        </div>

        <nav className="shell__nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-item ${isActive ? 'nav-item--active' : ''}`}
            >
              <span className="nav-item__label">{item.label}</span>
              <span className="nav-item__hint">{item.hint}</span>
            </NavLink>
          ))}
        </nav>

        <footer className="shell__footer">
          <span className="shell__pill">MVP</span>
          <span>Playback · OTel-ready</span>
        </footer>
      </aside>

      <div className="shell__main">
        <Outlet />
      </div>
    </div>
  );
}
