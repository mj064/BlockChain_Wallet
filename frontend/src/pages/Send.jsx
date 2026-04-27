import { useState } from "react";
import { createTx, sendTx } from "../api";

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
      return showAlert("Fill in all required fields.", "error");
    }
    if (!form.pub || !form.enc_pk) {
      return showAlert("No wallet loaded. Please create one on the dashboard first.", "error");
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
      const txRes = await createTx(payload);
      await sendTx(txRes.data);
      showAlert(`Successfully sent ${form.amount} BCW!`);
      setForm(p => ({ ...p, to: "", amount: "", password: "" }));
    } catch (e) {
      showAlert(e?.response?.data?.detail || "Transaction failed.", "error");
    } finally { setSending(false); }
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>Send Funds</h1>
        <p className="text-muted">Sign and broadcast a secure transaction to the network.</p>
      </div>

      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      <div className="card">
        {stored ? (
          <div style={{ padding: "16px", background: "rgba(36, 104, 229, 0.05)", border: "1px solid rgba(36, 104, 229, 0.2)", borderRadius: 8, marginBottom: 24 }}>
            <div className="label">Sending From Wallet</div>
            <div className="mono text-main">{stored.address}</div>
          </div>
        ) : (
          <div className="alert alert-error" style={{ marginBottom: 24 }}>
            No wallet loaded. Create one on the Dashboard first.
          </div>
        )}

        <div className="form-group">
          <label className="label">Recipient Address</label>
          <input
            className="input mono"
            placeholder="e.g. e56c58b879c76..."
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
            placeholder="Enter password to decrypt key"
            value={form.password}
            onChange={e => set("password", e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSend()}
          />
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

        <button className="btn btn-primary" style={{ width: "100%", padding: 14, marginTop: 12 }} onClick={handleSend} disabled={sending}>
          {sending ? <><div className="spinner" /> Processing Transaction…</> : "Confirm Send ↗"}
        </button>
      </div>
    </div>
  );
}