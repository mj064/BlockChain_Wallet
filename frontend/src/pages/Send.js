import { useState } from "react";
import { sendTransaction } from "../api";

export default function Send() {
    const [form, setForm] = useState({
        sender_public_key: "",
        receiver_address: "",
        amount: "",
        password: "",
        encrypted_private_key: ""
    });

    const handleSubmit = async () => {
        await sendTransaction(JSON.parse(form));
        alert("Transaction sent!");
    };

    return (
        <div>
            <h2>Send Transaction</h2>

            <textarea
                rows="10"
                placeholder="Paste full JSON from wallet"
                onChange={(e) => setForm(e.target.value)}
            />

            <button onClick={handleSubmit}>Send</button>
        </div>
    );
}