import { useState } from "react";
import { sendTx } from "../api";

export default function Send() {
  const stored = (() => {
    try { return JSON.parse(localStorage.getItem("bw_wallet")); } catch { return null; }
  })();

  const [form, setForm] = useState({
    to: "",
    amount: "",
    password: "",
    pub: stored?.public_key || "",
    enc_pk: stored ? JSON.stringify(stored.encrypted_private_key) : "",
  });
  const [sending, setSending] = useState(false);
  const [alert, setAlert]     = useState(null);

  const showAlert = (msg, type = "success") => {
    setAlert({ msg, type });
    setTimeout(() => setAlert(null), 5000);
  };

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSend = async () => {
    if (!form.to || !form.amount || !form.password) {
      return showAlert("fill in all required fields", "error");
    }
    if (!form.pub || !form.enc_pk) {
      return showAlert("no wallet loaded — create one on the dashboard first", "error");
    }
    setSending(true);
    try {
      const payload = {
        pub: form.pub,
        to: form.to,
        amt: parseFloat(form.amount),
        password: form.password,
        enc_pk: JSON.parse(form.enc_pk),
      };
      // create and immediately broadcast
      const { createTx, sendTx: broadcast } = await import("../api");
      const txRes = await createTx(payload);
      await broadcast(txRes.data);
      showAlert(`sent ${form.amount} BCW successfully!`);
      setForm(p => ({ ...p, to: "", amount: "", password: "" }));
    } catch (e) {
      showAlert(e?.response?.data?.detail || "transaction failed", "error");
    } finally { setSending(false); }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Send</h1>
        <p>Sign and broadcast a transaction to the network</p>
      </div>

      <div style={{ maxWidth: 560 }}>
        {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

        {stored ? (
          <div className="wallet-box" style={{ marginBottom: 24 }}>
            <div className="stat-label" style={{ marginBottom: 4 }}>Sending From</div>
            <div className="hash" style={{ fontSize: 13, color: "var(--text)" }}>{stored.address}</div>
          </div>
        ) : (
          <div className="alert alert-info" style={{ marginBottom: 24 }}>
            No wallet loaded — create one on the Dashboard first
          </div>
        )}

        <div className="card">
          <div className="form-group">
            <label className="label">Recipient Address</label>
            <input
              className="input"
              placeholder="Recipient wallet address"
              value={form.to}
              onChange={e => set("to", e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="label">Amount (BCW)</label>
            <input
              className="input"
              type="number"
              placeholder="0.00"
              min="0"
              step="any"
              value={form.amount}
              onChange={e => set("amount", e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="label">Wallet Password</label>
            <input
              className="input"
              type="password"
              placeholder="Decrypt your private key"
              value={form.password}
              onChange={e => set("password", e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSend()}
            />
            <div className="hint">Used to decrypt your private key locally and sign the transaction.</div>
          </div>

          {!stored && (
            <>
              <div className="form-group">
                <label className="label">Public Key (hex)</label>
                <input
                  className="input mono"
                  placeholder="Your public key"
                  value={form.pub}
                  onChange={e => set("pub", e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="label">Encrypted Private Key (JSON)</label>
                <textarea
                  className="input mono"
                  rows="4"
                  placeholder='{"cipher":"...","salt":"...","nonce":"..."}'
                  value={form.enc_pk}
                  onChange={e => set("enc_pk", e.target.value)}
                />
              </div>
            </>
          )}

          <button className="btn btn-primary" style={{ width: "100%" }} onClick={handleSend} disabled={sending}>
            {sending ? <><div className="spinner" />Signing & Broadcasting…</> : "Send Transaction ↗"}
          </button>
        </div>
      </div>
    </div>
  );
}