import { useState, useEffect } from "react";
import { createWallet, getChain, mine } from "./api";

export default function App() {
    const [wallet, setWallet] = useState(null);
    const [chain, setChain] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => { load() }, []);

    const load = async () => {
        try {
            const r = await getChain();
            setChain(r.data);
        } catch (e) { console.error("failed to load chain", e) }
    }

    const handleCreateWallet = async () => {
        const w = await createWallet("pass");
        setWallet(w.data);
    }

    const handleMine = async () => {
        if (!wallet) return alert("create a wallet first");
        setLoading(true);
        await mine(wallet.address);
        await load();
        setLoading(false);
    }

    return (
        <div style={{ padding: 40, fontFamily: 'Outfit, sans-serif', maxWidth: 800, margin: 'auto' }}>
            <h1 style={{ color: '#2d3436' }}>SecureChain</h1>

            <div style={{ marginBottom: 40 }}>
                <button onClick={handleCreateWallet} style={btnStyle}>Create Wallet</button>
                {wallet && (
                    <div style={{ marginTop: 20, padding: 20, background: '#f1f2f6', borderRadius: 12 }}>
                        <p><b>Address:</b> {wallet.address}</p>
                    </div>
                )}
            </div>

            <div style={{ marginBottom: 40 }}>
                <button onClick={handleMine} disabled={loading} style={btnStyle}>
                    {loading ? "Mining..." : "Mine Block"}
                </button>
            </div>

            <h3>Blockchain ({chain.length} blocks)</h3>
            <div>
                {chain.map((b, i) => (
                    <div key={i} style={blockStyle}>
                        <p><b>Block {b.index}</b></p>
                        <p style={{ fontSize: 12, color: '#636e72', wordBreak: 'break-all' }}>Hash: {b.hash}</p>
                        <p style={{ fontSize: 12, color: '#636e72' }}>Txs: {b.transactions.length}</p>
                    </div>
                ))}
            </div>
        </div>
    )
}

const btnStyle = {
    padding: '12px 24px',
    background: '#0984e3',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 'bold'
}

const blockStyle = {
    borderBottom: '1px solid #dfe6e9',
    padding: '20px 0'
}