import { useState, useEffect } from "react";
import { getChain } from "../api";

function fmt(ts) {
  return new Date(ts * 1000).toLocaleString();
}

function BlockCard({ block }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="block-card" style={{ marginBottom: 12 }}>
      <div className="block-header" onClick={() => setOpen(!open)}>
        <div className="block-index">
          <div className="block-num">#{block.index}</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>
              {block.index === 0 ? "Genesis Block" : `Block ${block.index}`}
            </div>
            <div className="block-meta">{fmt(block.timestamp)}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="badge badge-purple">{block.transactions.length} txs</span>
          <span style={{ color: "var(--muted)", fontSize: 18 }}>{open ? "∧" : "∨"}</span>
        </div>
      </div>

      {open && (
        <div className="block-body">
          <div style={{ paddingTop: 16 }}>
            <div style={{ marginBottom: 16 }}>
              <div className="label" style={{ marginBottom: 4 }}>Block Hash</div>
              <div className="hash">{block.hash}</div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div className="label" style={{ marginBottom: 4 }}>Previous Hash</div>
              <div className="hash">{block.previous_hash}</div>
            </div>
            <div style={{ display: "flex", gap: 20, marginBottom: 16 }}>
              <div>
                <div className="label">Nonce</div>
                <div className="mono" style={{ color: "var(--purple-light)" }}>{block.nonce}</div>
              </div>
              <div>
                <div className="label">Timestamp</div>
                <div style={{ fontSize: 13 }}>{fmt(block.timestamp)}</div>
              </div>
            </div>

            {block.transactions.length > 0 && (
              <>
                <div className="sep" />
                <div className="label" style={{ marginBottom: 12 }}>Transactions</div>
                {block.transactions.map((tx, i) => (
                  <div key={i} style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    padding: "12px 16px",
                    marginBottom: 8,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span className={`badge ${tx.sender === "SYSTEM" ? "badge-yellow" : "badge-purple"}`}>
                        {tx.sender === "SYSTEM" ? "⛏ Mining Reward" : "Transfer"}
                      </span>
                      <span style={{ fontWeight: 700, color: "var(--green)" }}>+{tx.amount} BCW</span>
                    </div>
                    {tx.sender !== "SYSTEM" && (
                      <div className="hash" style={{ fontSize: 11 }}>From: {tx.sender}</div>
                    )}
                    <div className="hash" style={{ fontSize: 11, marginTop: 4 }}>To: {tx.receiver}</div>
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
    <div>
      <div className="page-header">
        <h1>Block Explorer</h1>
        <p>Browse every block and transaction on the chain</p>
      </div>

      <div style={{ marginBottom: 24 }}>
        <input
          className="input"
          placeholder="Search by block number or hash…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 480 }}
        />
      </div>

      {loading ? (
        <div className="empty"><div className="mining-ring" /><div>Loading chain…</div></div>
      ) : filtered.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">⛓</div>
          <div>No blocks found</div>
        </div>
      ) : (
        filtered.map(b => <BlockCard key={b.index} block={b} />)
      )}
    </div>
  );
}