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
    if (!newUrl.trim()) return showAlert("Enter a valid node URL.", "error");
    setAdding(true);
    try {
      await addNode(newUrl.trim());
      showAlert("Node registered successfully.");
      setNewUrl("");
      await load();
    } catch { showAlert("Failed to register peer node.", "error"); }
    finally { setAdding(false); }
  };

  const handleResolve = async () => {
    setResolving(true);
    try {
      const r = await resolveChain();
      if (r.data.replaced) {
        showAlert(`Consensus reached: Chain replaced. Synced to length ${r.data.len}.`);
      } else {
        showAlert("Consensus reached: Our chain is authoritative. No updates needed.");
      }
      await load();
    } catch { showAlert("Consensus algorithm failed.", "error"); }
    finally { setResolving(false); }
  };

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>Network Node</h1>
        <p className="text-muted">Manage peer-to-peer connections and run consensus protocols.</p>
      </div>

      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div>
          <div className="card" style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 16, marginBottom: 20 }}>Register Peer</h3>
            <div className="form-group">
              <label className="label">Node URL</label>
              <input
                className="input"
                placeholder="http://192.168.1.5:8001"
                value={newUrl}
                onChange={e => setNewUrl(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAdd()}
              />
              <div className="text-muted" style={{ fontSize: 12, marginTop: 8 }}>Include the full HTTP protocol and port.</div>
            </div>
            <button className="btn btn-primary" onClick={handleAdd} disabled={adding} style={{ width: "100%", padding: 12 }}>
              {adding ? <><div className="spinner" /> Adding…</> : "Add Node"}
            </button>
          </div>

          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 16 }}>Consensus Protocol</h3>
              <span style={{ fontSize: 12, background: "rgba(36, 104, 229, 0.1)", color: "var(--accent-blue)", padding: "4px 8px", borderRadius: 4, fontWeight: 600 }}>
                {nodes.length} peers
              </span>
            </div>
            <p className="text-muted" style={{ fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
              Trigger the Longest-Chain rule. The node will query all registered peers and adopt the longest valid chain in the network.
            </p>
            <button
              className="btn btn-secondary"
              style={{ width: "100%", padding: 14 }}
              onClick={handleResolve}
              disabled={resolving || nodes.length === 0}
            >
              {resolving ? <><div className="spinner" /> Syncing…</> : "◉ Run Consensus"}
            </button>
            {nodes.length === 0 && (
              <div className="text-muted" style={{ fontSize: 12, marginTop: 12, textAlign: "center" }}>
                Add peers first to enable consensus syncing.
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="card" style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 16, marginBottom: 20 }}>Connected Peers ({nodes.length})</h3>
            {nodes.length === 0 ? (
              <div className="empty-state" style={{ padding: "40px 20px" }}>
                <div className="empty-icon" style={{ fontSize: 32 }}>◉</div>
                <div className="empty-text">No peers registered yet.</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {nodes.map((n, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-card-hover)", padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border-color)" }}>
                    <span className="mono" style={{ fontSize: 13, color: "#fff" }}>{n}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--green)", background: "rgba(14, 203, 129, 0.1)", padding: "4px 8px", borderRadius: 4 }}>
                      Online
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="card">
              <div className="label">Local Chain Blocks</div>
              <div style={{ fontSize: 24, fontWeight: 600, color: "#fff" }}>{stats?.blocks ?? "—"}</div>
            </div>
            <div className="card">
              <div className="label">Validation Status</div>
              <div style={{ fontSize: 24, fontWeight: 600, color: stats?.valid ? "var(--green)" : "var(--red)" }}>
                {stats == null ? "—" : stats.valid ? "Healthy" : "Corrupt"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
