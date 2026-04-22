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

  useEffect(() => { loadData(); }, []);

  const handleMine = async () => {
    if (!addr) return showAlert("enter a miner address", "error");
    setMining(true);
    setResult(null);
    try {
      const r = await mine(addr);
      setResult(r.data);
      await loadData();
      showAlert("block mined! +50 BCW reward earned");
    } catch { showAlert("mining failed — check the backend", "error"); }
    finally { setMining(false); }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Mining</h1>
        <p>Perform proof-of-work and earn block rewards</p>
      </div>

      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      <div className="grid-2" style={{ gap: 28, alignItems: "start" }}>
        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="section-title">Miner Address</div>
            <div className="form-group">
              <label className="label">Reward Recipient</label>
              <input
                className="input"
                placeholder="Your wallet address"
                value={addr}
                onChange={e => setAddr(e.target.value)}
              />
              <div className="hint">Block rewards (50 BCW) will be sent here.</div>
            </div>
            <button className="btn btn-primary" style={{ width: "100%" }} onClick={handleMine} disabled={mining}>
              {mining ? <><div className="spinner" />Mining…</> : "⛏ Mine Block"}
            </button>
          </div>

          {addr && balance !== null && (
            <div className="wallet-box">
              <div className="stat-label">Miner Balance</div>
              <div className="balance-display">{balance}<span className="balance-currency"> BCW</span></div>
            </div>
          )}
        </div>

        <div>
          <div className="grid-2" style={{ marginBottom: 20 }}>
            <div className="stat-card">
              <div className="stat-label">Chain Length</div>
              <div className="stat-value stat-purple">{stats?.blocks ?? "—"}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Difficulty</div>
              <div className="stat-value stat-green">{stats?.difficulty ?? "—"}</div>
            </div>
          </div>

          {mining && (
            <div className="card" style={{ textAlign: "center", padding: 40 }}>
              <div className="mining-ring" />
              <div style={{ color: "var(--purple-light)", fontWeight: 600 }}>Mining in progress…</div>
              <div className="hint" style={{ marginTop: 8 }}>Searching for valid proof of work</div>
            </div>
          )}

          {result && !mining && (
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                <div className="section-title" style={{ marginBottom: 0 }}>Block Mined</div>
                <span className="badge badge-green">✓ Success</span>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div className="label">Block Index</div>
                <div style={{ fontWeight: 700, fontSize: 22, color: "var(--purple-light)" }}>#{result.index}</div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div className="label">Hash</div>
                <div className="hash">{result.hash}</div>
              </div>
              <div style={{ display: "flex", gap: 20 }}>
                <div>
                  <div className="label">Nonce</div>
                  <div className="mono" style={{ color: "var(--yellow)" }}>{result.nonce}</div>
                </div>
                <div>
                  <div className="label">Transactions</div>
                  <div>{result.transactions?.length}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
