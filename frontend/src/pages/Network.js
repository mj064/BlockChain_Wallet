import { useState, useEffect } from "react";
import { getNodes, addNode, resolveChain, getStats } from "../api";

export default function Network() {
  const [nodes, setNodes]       = useState([]);
  const [newUrl, setNewUrl]     = useState("");
  const [adding, setAdding]     = useState(false);
  const [resolving, setResolving] = useState(false);
  const [stats, setStats]       = useState(null);
  const [alert, setAlert]       = useState(null);

  const showAlert = (msg, type = "success") => {
    setAlert({ msg, type });
    setTimeout(() => setAlert(null), 5000);
  };

  const load = async () => {
    try {
      const [n, s] = await Promise.all([getNodes(), getStats()]);
      setNodes(n.data.nodes || []);
      setStats(s.data);
    } catch {}
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!newUrl.trim()) return showAlert("enter a node URL", "error");
    setAdding(true);
    try {
      await addNode(newUrl.trim());
      showAlert("node registered successfully");
      setNewUrl("");
      await load();
    } catch { showAlert("failed to add node", "error"); }
    finally { setAdding(false); }
  };

  const handleResolve = async () => {
    setResolving(true);
    try {
      const r = await resolveChain();
      if (r.data.replaced) {
        showAlert(`chain replaced — synced to length ${r.data.len}`);
      } else {
        showAlert("our chain is authoritative — no update needed");
      }
      await load();
    } catch { showAlert("consensus failed", "error"); }
    finally { setResolving(false); }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Network</h1>
        <p>Manage peer nodes and synchronise the chain</p>
      </div>

      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      <div className="grid-2" style={{ gap: 28, alignItems: "start" }}>
        {/* Node management */}
        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="section-title">Register Peer Node</div>
            <div className="form-group">
              <label className="label">Node URL</label>
              <input
                className="input"
                placeholder="http://localhost:8001"
                value={newUrl}
                onChange={e => setNewUrl(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAdd()}
              />
              <div className="hint">Full URL of the peer node including port.</div>
            </div>
            <button className="btn btn-primary" onClick={handleAdd} disabled={adding}>
              {adding ? <><div className="spinner" />Adding…</> : "Add Node"}
            </button>
          </div>

          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div className="section-title" style={{ marginBottom: 0 }}>Consensus</div>
              <span className="badge badge-purple">{nodes.length} peers</span>
            </div>
            <p style={{ color: "var(--muted2)", fontSize: 14, marginBottom: 16, lineHeight: 1.6 }}>
              Run the longest-chain consensus algorithm to sync this node with the network.
            </p>
            <button
              className="btn btn-ghost"
              style={{ width: "100%" }}
              onClick={handleResolve}
              disabled={resolving || nodes.length === 0}
            >
              {resolving ? <><div className="spinner" />Resolving…</> : "◉ Run Consensus"}
            </button>
            {nodes.length === 0 && (
              <div className="hint" style={{ marginTop: 10, textAlign: "center" }}>add peers first to enable consensus</div>
            )}
          </div>
        </div>

        {/* Peers + stats */}
        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="section-title">Peer Nodes ({nodes.length})</div>
            {nodes.length === 0 ? (
              <div className="empty" style={{ padding: "30px 20px" }}>
                <div className="empty-icon" style={{ fontSize: 32 }}>◉</div>
                <div>No peers registered yet</div>
              </div>
            ) : (
              nodes.map((n, i) => (
                <div className="node-item" key={i}>
                  <span>{n}</span>
                  <span className="badge badge-green">online</span>
                </div>
              ))
            )}
          </div>

          <div className="grid-2">
            <div className="stat-card">
              <div className="stat-label">Our Blocks</div>
              <div className="stat-value stat-purple">{stats?.blocks ?? "—"}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Chain Valid</div>
              <div className="stat-value" style={{ color: stats?.valid ? "var(--green)" : "var(--red)" }}>
                {stats == null ? "—" : stats.valid ? "✓" : "✗"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
