import { useEffect, useState } from "react";
import { getChain } from "../api";

export default function Explorer() {
    const [chain, setChain] = useState([]);

    const fetchChain = async () => {
        const res = await getChain();
        setChain(res.data.chain);
    };

    useEffect(() => {
        fetchChain();
    }, []);

    return (
        <div>
            <h2>Blockchain Explorer</h2>

            {chain.map((block, i) => (
                <div key={i} style={{ border: "1px solid black", margin: 10 }}>
                    <p><b>Index:</b> {block.index}</p>
                    <p><b>Hash:</b> {block.hash}</p>
                    <p><b>Tx Count:</b> {block.transactions.length}</p>
                </div>
            ))}
        </div>
    );
}