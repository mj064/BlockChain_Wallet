import { ProductionWalletApp } from "../production/ProductionWalletApp";
import {
  createProductionApiClient,
  type ProductionApiClient,
} from "../production/api";

type StoredWallet = {
  address?: string;
};

type Props = {
  apiClient?: ProductionApiClient;
};

function readStoredWallet(): StoredWallet | null {
  try {
    const raw = localStorage.getItem("bw_wallet");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function ProductionPaymentsPage({
  apiClient = createProductionApiClient(),
}: Props) {
  const wallet = readStoredWallet();
  const walletAddress = wallet?.address;

  if (!walletAddress) {
    return (
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div className="card" style={{ textAlign: "center" }}>
          <div
            style={{
              width: 64,
              height: 64,
              margin: "0 auto 20px",
              borderRadius: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background:
                "linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(139, 92, 246, 0.15))",
              fontSize: 28,
            }}
          >
            $
          </div>
          <h1 style={{ fontSize: 30, marginBottom: 12 }}>Production payments</h1>
          <p className="text-muted" style={{ lineHeight: 1.7, marginBottom: 24 }}>
            Create a wallet on the Dashboard first to unlock production payments.
          </p>
          <a className="btn btn-primary" href="/">
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <ProductionWalletApp
      apiClient={apiClient}
      initialWalletAddress={walletAddress}
    />
  );
}

export default ProductionPaymentsPage;
