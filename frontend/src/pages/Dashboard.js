import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { createWallet, getBalance, getTxHistory, getStats } from "../api";

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [wallet, setWallet] = useState(() => {
    try { return JSON.parse(localStorage.getItem("bw_wallet")); } catch { return null; }
  });
  const [balance, setBalance] = useState("0.00");
  const [history, setHistory] = useState([]);
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [alert, setAlert] = useState(null);

  const showAlert = (msg, type = "success") => {
    setAlert({ msg, type });
    setTimeout(() => setAlert(null), 4000);
  };

  const loadData = useCallback(async () => {
    try {
      const s = await getStats();
      setStats(s.data);
      if (wallet) {
        const [b, h] = await Promise.all([
          getBalance(wallet.address),
          getTxHistory(wallet.address),
        ]);
        setBalance(b.data.balance.toFixed(2));
        setHistory(h.data);
      }
    } catch {}
  }, [wallet]);

  useEffect(() => {
    loadData();
    const t = setInterval(loadData, 5000);
    return () => clearInterval(t);
  }, [loadData]);

  const handleCreate = async () => {
    if (!password) return showAlert("Enter a password", "error");
    setCreating(true);
    try {
      const res = await createWallet(password);
      setWallet(res.data);
      localStorage.setItem("bw_wallet", JSON.stringify(res.data));
      showAlert("Wallet created successfully!");
      setPassword("");
    } catch { showAlert("Failed to create wallet", "error"); }
    finally { setCreating(false); }
  };

  const shortAddr = addr => addr ? addr.slice(0, 12) + "…" + addr.slice(-8) : "";

  if (!wallet) {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <div className="login-logo">₿</div>
          <h2 style={{ marginBottom: 12 }}>Create Secure Wallet</h2>
          <p className="text-muted" style={{ marginBottom: 32, fontSize: 14 }}>
            Enter a secure password to generate your keys. This password will encrypt your private key locally.
          </p>
          
          {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

          <div className="form-group" style={{ textAlign: "left" }}>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              placeholder="Min 8 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCreate()}
            />
          </div>
          <button className="btn btn-primary" style={{ width: "100%", padding: 14 }} onClick={handleCreate} disabled={creating}>
            {creating ? <><div className="spinner" /> Creating Wallet…</> : "Create Wallet"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      <div className="dashboard-top">
        <div className="balance-card">
          <div>
            <div className="balance-label">Total funds</div>
            <div className="balance-value">
              {balance} <span className="balance-currency">BCW</span>
            </div>
            <div className="mono text-muted" style={{ fontSize: 13, marginTop: 16 }}>
              {wallet.address}
            </div>
          </div>
          <div className="balance-actions">
            <button className="btn btn-secondary" onClick={() => {
              navigator.clipboard.writeText(wallet.address);
              showAlert("Address copied!");
            }}>
              ↓ Deposit
            </button>
            <Link to="/send" className="btn btn-primary">
              ↗ Withdraw
            </Link>
          </div>
        </div>

        <div className="stats-card">
          <div className="stat-row">
            <span className="stat-label">Network Blocks</span>
            <span className="stat-val">{stats?.blocks ?? "—"}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Difficulty</span>
            <span className="stat-val text-green">{stats?.difficulty ?? "—"}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Chain Status</span>
            <span className={`stat-val ${stats?.valid ? "text-green" : "text-red"}`}>
              {stats == null ? "—" : stats.valid ? "Healthy" : "Invalid"}
            </span>
          </div>
          <div className="stat-row" style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border-color)" }}>
            <Link to="/mine" className="btn btn-outline" style={{ width: "100%" }}>
              ⛏ Mine Block
            </Link>
          </div>
        </div>
      </div>

      <div className="table-container">
        <div style={{ padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)" }}>
          <h3 style={{ fontSize: 16 }}>Recent transactions</h3>
          <Link to="/explorer" className="text-muted" style={{ fontSize: 13, textDecoration: "none" }}>See all &gt;</Link>
        </div>
        
        <div className="table-header">
          <div>Type</div>
          <div>Status</div>
          <div>Address</div>
          <div style={{ textAlign: "right" }}>Amount</div>
          <div style={{ textAlign: "right" }}>Block</div>
        </div>

        {history.length === 0 ? (
          <div className="empty-state">
            <div className="empty-text">No transactions found</div>
          </div>
        ) : (
          history.slice(0, 10).map((tx, i) => {
            const isMine = tx.sender === "SYSTEM" && tx.receiver === wallet.address;
            const isSend = tx.sender === wallet.address;
            const isReceive = tx.receiver === wallet.address && !isMine;
            
            let icon = "↓"; let iconClass = "receive"; let title = "Received"; let sign = "+";
            if (isSend) { icon = "↗"; iconClass = "send"; title = "Sent"; sign = "-"; }
            if (isMine) { icon = "⛏"; iconClass = "mine"; title = "Mined Reward"; sign = "+"; }

            return (
              <div className="tx-row" key={i}>
                <div className="tx-cell">
                  <div className={`tx-icon-wrap ${iconClass}`}>{icon}</div>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{title}</div>
                    <div className="text-muted" style={{ fontSize: 12 }}>BCW</div>
                  </div>
                </div>
                
                <div className="tx-cell">
                  <span className="tx-status-badge completed">Completed</span>
                </div>
                
                <div className="tx-cell mono">
                  {isSend ? `To: ${shortAddr(tx.receiver)}` : isReceive ? `From: ${shortAddr(tx.sender)}` : "System Reward"}
                </div>
                
                <div className="tx-cell mono" style={{ justifyContent: "flex-end", color: sign === "+" ? "var(--green)" : "var(--text-main)", fontWeight: 500 }}>
                  {sign}{parseFloat(tx.amount).toFixed(2)} BCW
                </div>
                
                <div className="tx-cell" style={{ justifyContent: "flex-end", color: "var(--text-muted)" }}>
                  #{tx.block_index}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}