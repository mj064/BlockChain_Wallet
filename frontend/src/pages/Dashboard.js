import { useEffect, useState } from "react";
import { createWallet, getChain, mineBlock } from "../api";

export default function Dashboard() {
    const [wallet, setWallet] = useState(null);
    const [chain, setChain] = useState([]);

    const handleCreateWallet = async () => {
        const res = await createWallet("mypassword");
        setWallet(res.data.wallet);
    };

    const fetchChain = async () => {
        const res = await getChain();
        setChain(res.data.chain);
    };

    const handleMine = async () => {
        if (!wallet) return;
        await mineBlock(wallet.address);
        fetchChain();
    };

    useEffect(() => {
        fetchChain();
    }, []);

    return (
        <div>
            <h2>Dashboard</h2>

            <button onClick={handleCreateWallet}>Create Wallet</button>

            {wallet && (
                <div>
                    <p><b>Address:</b> {wallet.address}</p>
                </div>
            )}

            <button onClick={handleMine}>Mine Block</button>

            <h3>Blocks: {chain.length}</h3>
        </div>
    );
}