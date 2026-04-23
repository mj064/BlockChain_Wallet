import { useState, useEffect } from "react";
import { mine, getStats, getBalance } from "../api";

export default function Mine() {
  const stored = (() => {
    try { return JSON.parse(localStorage.getItem("bw_wallet")); } catch { return null; }
  })();

  const [addr, setAddr]       = useState(stored?.address || "");
  const [mining, setMining]   = useState(false);
  const [result, setResult]   = useState(null);
  const [stats, setStats]     = useState(null);
  const [balance, setBalance] = useState(null);
  const [alert, setAlert]     = useState(null);

  const showAlert = (msg, type = "success") => {
    setAlert({ msg, type });
    setTimeout(() => setAlert(null), 6000);
  };

  const loadData = async () => {
    try {
      const s = await getStats();
      setStats(s.data);
      if (addr) {
        const b = await getBalance(addr);
        setBalance(b.data.balance);
      }
    } catch {}
  };

  useEffect(() => { loadData(); }, [addr]);

  const handleMine = async () => {
    if (!addr) return showAlert("Enter a miner address first.", "error");
    setMining(true);
    setResult(null);
    try {
      const r = await mine(addr);
      setResult(r.data);
      await loadData();
      showAlert("Block successfully mined! 50 BCW reward earned.");
    } catch { showAlert("Mining failed. Check the backend network.", "error"); }
    finally { setMining(false); }
  };

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>Mining Pool</h1>
        <p className="text-muted">Perform proof-of-work validation and earn block rewards.</p>
      </div>

      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div>
          <div className="card" style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 16, marginBottom: 20 }}>Configure Miner</h3>
            <div className="form-group">
              <label className="label">Reward Recipient Address</label>
              <input
                className="input mono"
                placeholder="e.g. e56c58b879c76..."
                value={addr}
                onChange={e => setAddr(e.target.value)}
              />
              <div className="text-muted" style={{ fontSize: 12, marginTop: 8 }}>Block rewards (50 BCW) will be credited here.</div>
            </div>
            <button className="btn btn-primary" style={{ width: "100%", padding: 14, fontSize: 16 }} onClick={handleMine} disabled={mining}>
              {mining ? <><div className="spinner" /> Validating Hash…</> : "⛏ Start Mining"}
            </button>
          </div>

          {addr && balance !== null && (
            <div className="card" style={{ background: "linear-gradient(135deg, var(--bg-card) 0%, #1a2235 100%)" }}>
              <div className="label">Miner Balance</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: "#fff" }}>
                {parseFloat(balance).toFixed(2)} <span style={{ fontSize: 16, color: "var(--text-muted)" }}>BCW</span>
              </div>
            </div>
          )}
        </div>

        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
            <div className="card">
              <div className="label">Chain Length</div>
              <div style={{ fontSize: 24, fontWeight: 600, color: "#fff" }}>{stats?.blocks ?? "—"}</div>
            </div>
            <div className="card">
              <div className="label">Difficulty</div>
              <div style={{ fontSize: 24, fontWeight: 600, color: "var(--green)" }}>{stats?.difficulty ?? "—"}</div>
            </div>
          </div>

          {mining && (
            <div className="card" style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ width: 80, height: 80, border: "3px solid var(--border-color)", borderTopColor: "var(--accent-blue)", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 24px" }} />
              <h3 style={{ color: "var(--accent-blue)", marginBottom: 8 }}>Mining in progress...</h3>
              <p className="text-muted" style={{ fontSize: 14 }}>Searching for a valid proof-of-work hash.</p>
            </div>
          )}

          {result && !mining && (
            <div className="card" style={{ border: "1px solid rgba(14, 203, 129, 0.3)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
                <h3 style={{ fontSize: 16, color: "var(--green)" }}>Block Mined Successfully</h3>
                <span className="text-green">✓</span>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div className="label">Block Index</div>
                <div style={{ fontSize: 20, fontWeight: 600, color: "#fff" }}>#{result.index}</div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div className="label">Hash Result</div>
                <div className="mono text-muted" style={{ fontSize: 13, wordBreak: "break-all" }}>{result.hash}</div>
              </div>
              <div style={{ display: "flex", gap: 32 }}>
                <div>
                  <div className="label">Winning Nonce</div>
                  <div className="mono" style={{ color: "#F59E0B", fontWeight: 500 }}>{result.nonce}</div>
                </div>
                <div>
                  <div className="label">Included TXs</div>
                  <div style={{ color: "#fff", fontWeight: 500 }}>{result.transactions?.length}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
