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
        style={{ padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", background: open ? "var(--bg-card-hover)" : "transparent" }}
        onClick={() => setOpen(!open)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 40, height: 40, background: "rgba(36, 104, 229, 0.1)", color: "var(--accent-blue)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
            #{block.index}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, color: "#fff" }}>
              {block.index === 0 ? "Genesis Block" : `Block ${block.index}`}
            </div>
            <div className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>{fmt(block.timestamp)}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 13, color: "var(--text-main)", background: "#2B3139", padding: "4px 10px", borderRadius: 4 }}>
            {block.transactions.length} TXs
          </span>
          <span className="text-muted">{open ? "▲" : "▼"}</span>
        </div>
      </div>

      {open && (
        <div style={{ padding: "0 24px 24px", borderTop: "1px solid var(--border-color)" }}>
          <div style={{ paddingTop: 20 }}>
            <div className="form-group">
              <label className="label">Block Hash</label>
              <div className="mono" style={{ fontSize: 13, color: "var(--text-main)", wordBreak: "break-all" }}>{block.hash}</div>
            </div>
            <div className="form-group">
              <label className="label">Previous Hash</label>
              <div className="mono" style={{ fontSize: 13, color: "var(--text-muted)", wordBreak: "break-all" }}>{block.previous_hash}</div>
            </div>
            <div style={{ display: "flex", gap: 40, marginBottom: 20 }}>
              <div>
                <label className="label">Nonce</label>
                <div className="mono text-green">{block.nonce}</div>
              </div>
              <div>
                <label className="label">Timestamp</label>
                <div style={{ fontSize: 14 }}>{fmt(block.timestamp)}</div>
              </div>
            </div>

            {block.transactions.length > 0 && (
              <>
                <label className="label" style={{ marginTop: 24, borderTop: "1px solid var(--border-color)", paddingTop: 20 }}>Transactions in this block</label>
                {block.transactions.map((tx, i) => (
                  <div key={i} style={{
                    background: "var(--bg-card-hover)",
                    border: "1px solid var(--border-color)",
                    borderRadius: 8,
                    padding: "16px",
                    marginBottom: 8,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: tx.sender === "SYSTEM" ? "var(--accent-blue)" : "var(--text-main)" }}>
                        {tx.sender === "SYSTEM" ? "⛏ Mining Reward" : "Transfer"}
                      </span>
                      <span className="mono text-green" style={{ fontWeight: 600 }}>+{tx.amount} BCW</span>
                    </div>
                    {tx.sender !== "SYSTEM" && (
                      <div className="mono text-muted" style={{ fontSize: 12 }}>From: {tx.sender}</div>
                    )}
                    <div className="mono text-muted" style={{ fontSize: 12, marginTop: 4 }}>To: {tx.receiver}</div>
                  </div>
                ))}
              </>
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
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>Block Explorer</h1>
        <p className="text-muted">Browse every block and transaction on the SecureChain network.</p>
      </div>

      <div style={{ marginBottom: 24 }}>
        <input
          className="input"
          placeholder="Search by block number or exact hash..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="empty-state"><div className="spinner" style={{ margin: "0 auto 16px", width: 32, height: 32 }} /><div>Loading chain data...</div></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">⛓</div>
          <div className="empty-text">No blocks found matching your search.</div>
        </div>
      ) : (
        filtered.map(b => <BlockCard key={b.index} block={b} />)
      )}
    </div>
  );
}