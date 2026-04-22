import { NavLink } from "react-router-dom";

const items = [
  { to: "/",        label: "Dashboard", icon: "◈" },
  { to: "/send",    label: "Send",      icon: "↗" },
  { to: "/explorer",label: "Explorer",  icon: "⛓" },
  { to: "/mine",    label: "Mine",      icon: "⛏" },
  { to: "/network", label: "Network",   icon: "◉" },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">₿</div>
        <div>
          <div className="logo-name">BlockChain</div>
          <div className="logo-sub">Wallet</div>
        </div>
      </div>
      <nav className="sidebar-nav">
        {items.map(i => (
          <NavLink
            key={i.to}
            to={i.to}
            end={i.to === "/"}
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          >
            <span className="nav-icon">{i.icon}</span>
            <span>{i.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="status-dot" />
        <span>Node online</span>
      </div>
    </aside>
  );
}
