import { useState, useEffect } from "react";
import { getChain } from "../api";

function fmt(ts) {
  return new Date(ts * 1000).toLocaleString();
}

function BlockCard({ block }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card" style={{ marginBottom: 16, padding: 0, overflow: "hidden" }}>
      <div 
        style={{ padding: "24px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", transition: "background 0.3s ease" }}
        className={open ? "glass-hover" : ""}
        onClick={() => setOpen(!open)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ 
            width: 48, height: 48, 
            background: "linear-gradient(135deg, rgba(6, 182, 212, 0.1), rgba(139, 92, 246, 0.1))", 
            color: "var(--accent-secondary)", 
            borderRadius: 14, 
            display: "flex", alignItems: "center", justifyContent: "center", 
            fontWeight: 800, fontSize: 18,
            border: "1px solid rgba(6, 182, 212, 0.2)"
          }}>
            #{block.index}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#fff" }}>
              {block.index === 0 ? "Genesis Block" : `Block ${block.index}`}
            </div>
            <div className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>{fmt(block.timestamp)}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <span style={{ 
            fontSize: 12, color: "#fff", 
            background: "rgba(255,255,255,0.05)", 
            padding: "6px 14px", borderRadius: 20,
            fontWeight: 700, border: "1px solid var(--glass-border)"
          }}>
            {block.transactions.length} Transactions
          </span>
          <span className="text-muted" style={{ fontSize: 12 }}>{open ? "▲" : "▼"}</span>
        </div>
      </div>

      {open && (
        <div style={{ padding: "0 32px 32px", borderTop: "1px solid var(--glass-border)" }}>
          <div style={{ paddingTop: 24 }}>
            <div className="form-group">
              <label className="label">Block Hash</label>
              <div className="mono" style={{ fontSize: 13, color: "#fff", wordBreak: "break-all", background: "rgba(0,0,0,0.2)", padding: 12, borderRadius: 12 }}>{block.hash}</div>
            </div>
            <div className="form-group">
              <label className="label">Previous Hash</label>
              <div className="mono" style={{ fontSize: 13, color: "var(--text-muted)", wordBreak: "break-all" }}>{block.previous_hash}</div>
            </div>
            <div style={{ display: "flex", gap: 48, marginBottom: 24 }}>
              <div>
                <label className="label">Nonce</label>
                <div className="mono text-green" style={{ fontWeight: 700, fontSize: 16 }}>{block.nonce}</div>
              </div>
              <div>
                <label className="label">Difficulty</label>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>4</div>
              </div>
            </div>

            {block.transactions.length > 0 && (
              <div style={{ marginTop: 32 }}>
                <label className="label" style={{ marginBottom: 16 }}>Transactions in this block</label>
                {block.transactions.map((tx, i) => (
                  <div key={i} style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid var(--glass-border)",
                    borderRadius: 16,
                    padding: "20px",
                    marginBottom: 12,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: tx.sender === "SYSTEM" ? "var(--accent-primary)" : "#fff" }}>
                        {tx.sender === "SYSTEM" ? "⛏ Mining Reward" : "Standard Transfer"}
                      </span>
                      <span className="mono text-green" style={{ fontWeight: 800, fontSize: 15 }}>+{tx.amount} BCW</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      <div>
                        <div className="label" style={{ fontSize: 10, marginBottom: 4 }}>Sender</div>
                        <div className="mono text-muted" style={{ fontSize: 12, wordBreak: "break-all" }}>{tx.sender}</div>
                      </div>
                      <div>
                        <div className="label" style={{ fontSize: 10, marginBottom: 4 }}>Receiver</div>
                        <div className="mono text-muted" style={{ fontSize: 12, wordBreak: "break-all" }}>{tx.receiver}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Explorer() {
  const [chain, setChain]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");

  const load = async () => {
    try {
      const r = await getChain();
      setChain([...r.data].reverse());
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, []);

  const filtered = chain.filter(b =>
    String(b.index).includes(search) || b.hash.includes(search)
  );

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ marginBottom: 48 }}>
        <h1 style={{ fontSize: 32, marginBottom: 12 }}>Block Explorer</h1>
        <p className="text-muted" style={{ fontSize: 16 }}>Inspect real-time blocks and transaction data on the SecureChain network.</p>
      </div>

      <div style={{ marginBottom: 32 }}>
        <input
          className="input"
          placeholder="Search by block height or hash..."
          style={{ height: 60, fontSize: 16 }}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="empty-state">
          <div className="spinner" style={{ width: 40, height: 40, margin: "0 auto 20px" }} />
          <div style={{ fontSize: 16 }}>Synchronizing ledger...</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">⛓</div>
          <div className="empty-text" style={{ fontSize: 16 }}>No matching blocks found in the current chain segment.</div>
        </div>
      ) : (
        filtered.map(b => <BlockCard key={b.index} block={b} />)
      )}
    </div>
  );
}