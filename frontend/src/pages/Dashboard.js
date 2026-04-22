import { useState, useEffect, useCallback } from "react";
import { createWallet, getBalance, getTxHistory, getStats, getMempool } from "../api";

export default function Dashboard() {
  const [stats, setStats]     = useState(null);
  const [mempool, setMempool] = useState({ count: 0, transactions: [] });
  const [wallet, setWallet]   = useState(() => {
    try { return JSON.parse(localStorage.getItem("bw_wallet")); } catch { return null; }
  });
  const [balance, setBalance] = useState(null);
  const [history, setHistory] = useState([]);
  const [password, setPassword]   = useState("");
  const [creating, setCreating]   = useState(false);
  const [alert, setAlert]         = useState(null);

  const showAlert = (msg, type = "success") => {
    setAlert({ msg, type });
    setTimeout(() => setAlert(null), 4000);
  };

  const loadStats = useCallback(async () => {
    try {
      const [s, m] = await Promise.all([getStats(), getMempool()]);
      setStats(s.data);
      setMempool(m.data);
    } catch {}
  }, []);

  const loadWalletData = useCallback(async () => {
    if (!wallet) return;
    try {
      const [b, h] = await Promise.all([
        getBalance(wallet.address),
        getTxHistory(wallet.address),
      ]);
      setBalance(b.data.balance);
      setHistory(h.data.slice(0, 8));
    } catch {}
  }, [wallet]);

  useEffect(() => {
    loadStats();
    loadWalletData();
    const t = setInterval(() => { loadStats(); loadWalletData(); }, 5000);
    return () => clearInterval(t);
  }, [loadStats, loadWalletData]);

  const handleCreate = async () => {
    if (!password) return showAlert("enter a password first", "error");
    setCreating(true);
    try {
      const res = await createWallet(password);
      const w = res.data;
      setWallet(w);
      localStorage.setItem("bw_wallet", JSON.stringify(w));
      showAlert("wallet created successfully");
      setPassword("");
    } catch { showAlert("failed to create wallet", "error"); }
    finally { setCreating(false); }
  };

  const shortAddr = addr => addr ? addr.slice(0, 8) + "…" + addr.slice(-6) : "";

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Your blockchain wallet overview</p>
      </div>

      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      {/* Stats Row */}
      <div className="grid-4" style={{ marginBottom: 28 }}>
        <div className="stat-card">
          <div className="stat-label">Blocks</div>
          <div className="stat-value stat-purple">{stats?.blocks ?? "—"}</div>
          <div className="stat-sub">in chain</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total TXs</div>
          <div className="stat-value">{stats?.total_txs ?? "—"}</div>
          <div className="stat-sub">confirmed</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Mempool</div>
          <div className="stat-value stat-yellow">{mempool.count}</div>
          <div className="stat-sub">pending</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Difficulty</div>
          <div className="stat-value stat-green">{stats?.difficulty ?? "—"}</div>
          <div className="stat-sub">leading zeros</div>
        </div>
      </div>

      <div className="grid-2" style={{ gap: 24 }}>
        {/* Wallet Panel */}
        <div>
          {wallet ? (
            <div className="wallet-box" style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <div className="stat-label">Wallet Address</div>
                  <div className="hash" style={{ fontSize: 13, color: "var(--text)" }}>{wallet.address}</div>
                </div>
                <span className="badge badge-green">Active</span>
              </div>
              <hr className="sep" />
              <div>
                <div className="stat-label">Balance</div>
                <div>
                  <span className="balance-display">{balance ?? "—"}</span>
                  <span className="balance-currency">BCW</span>
                </div>
              </div>
              <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 13 }}
                  onClick={() => { setWallet(null); localStorage.removeItem("bw_wallet"); }}
                >
                  Disconnect
                </button>
              </div>
            </div>
          ) : (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="section-title">Create Wallet</div>
              <div className="form-group">
                <label className="label">Password</label>
                <input
                  className="input"
                  type="password"
                  placeholder="Enter a secure password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleCreate()}
                />
                <div className="hint">Your private key will be encrypted with this password.</div>
              </div>
              <button className="btn btn-primary" onClick={handleCreate} disabled={creating}>
                {creating ? <><div className="spinner" />Creating…</> : "Create Wallet"}
              </button>
            </div>
          )}
        </div>

        {/* TX History */}
        <div className="card">
          <div className="section-title">Recent Transactions</div>
          {history.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">↕</div>
              <div>No transactions yet</div>
            </div>
          ) : (
            history.map((tx, i) => {
              const sent = tx.sender === wallet?.address;
              return (
                <div className="tx-row" key={i}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span className={`badge ${sent ? "badge-red" : "badge-green"}`}>
                        {sent ? "↑ Sent" : "↓ Received"}
                      </span>
                      <span className="badge badge-purple">Block #{tx.block_index}</span>
                    </div>
                    <div className="tx-addr">
                      {sent ? `→ ${shortAddr(tx.receiver)}` : `← ${shortAddr(tx.sender)}`}
                    </div>
                  </div>
                  <div className={`tx-amount ${sent ? "" : "stat-green"}`} style={{ color: sent ? "var(--red)" : "var(--green)" }}>
                    {sent ? "-" : "+"}{tx.amount} BCW
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Mempool Preview */}
      {mempool.transactions.length > 0 && (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="section-title">Mempool ({mempool.count} pending)</div>
          {mempool.transactions.map((tx, i) => (
            <div className="tx-row" key={i}>
              <div>
                <div className="tx-addr">{tx.sender?.slice(0,14)}… → {tx.receiver?.slice(0,14)}…</div>
              </div>
              <span className="badge badge-yellow">{tx.amount} BCW</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}