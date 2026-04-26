const API_BASE = "http://localhost:8000/api/v1";

export type SupportedChain = "base" | "arbitrum" | "polygon";
export type Asset = "USDC";
export type PaymentIntentStatus =
  | "draft"
  | "awaiting_signature"
  | "submitted"
  | "confirmed"
  | "failed"
  | "expired";
export type RiskDecision = "allow" | "warn" | "block";

export interface PortfolioBalance {
  chain: SupportedChain;
  asset: Asset;
  amount: string;
  contractAddress: string;
}

export interface PortfolioResponse {
  walletAddress: string;
  balances: PortfolioBalance[];
}

export interface PaymentIntentDraftInput {
  recipient: string;
  amount: string;
  chainPreference: SupportedChain;
  note?: string;
}

export interface PaymentIntentQuoteInput {
  recipient: string;
  amount: string;
  chainPreference: SupportedChain;
}

export interface PaymentIntentQuoteResponse {
  recipient: string;
  amount: string;
  asset: Asset;
  chain: SupportedChain;
  riskDecision: RiskDecision;
  estimatedNetworkFee: string;
  estimatedSettlementAmount: string;
  policyNotice: string | null;
  dailyLimitUsdc: string;
  dailySpentUsdc: string;
  dailyAvailableUsdc: string;
}

export interface PaymentIntentResponse {
  id: string;
  senderWallet: string;
  recipient: string;
  amount: string;
  asset: Asset;
  chain: SupportedChain;
  status: PaymentIntentStatus;
  riskDecision: RiskDecision;
  note: string | null;
  txHash: string | null;
  confirmations: number;
  receiptUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ActivityEventKind =
  | "intent_created"
  | "tx_submitted"
  | "receipt_issued"
  | "webhook_received";

export interface ActivityEventResponse {
  id: string;
  kind: ActivityEventKind;
  intentId: string;
  chain: SupportedChain;
  asset: Asset;
  amount: string;
  status: PaymentIntentStatus | null;
  txHash: string | null;
  receiptUrl: string | null;
  webhookSource: string | null;
  webhookType: string | null;
  occurredAt: string;
}

export interface ContactCreateInput {
  label: string;
  walletAddress: string;
}

export interface ContactResponse {
  id: string;
  ownerWallet: string;
  label: string;
  walletAddress: string;
}

export interface ContactDeleteResponse {
  deleted: boolean;
  contactId: string;
}

export interface PaymentIntentListParams {
  limit?: number;
  status?: PaymentIntentStatus;
  chain?: SupportedChain;
}

export interface ProductionApiClient {
  getPortfolio(walletAddress: string): Promise<PortfolioResponse>;
  listPaymentIntents(
    walletAddress: string,
    params?: PaymentIntentListParams,
  ): Promise<PaymentIntentResponse[]>;
  listActivityEvents(
    walletAddress: string,
    limit?: number,
  ): Promise<ActivityEventResponse[]>;
  submitPaymentIntent(
    walletAddress: string,
    intentId: string,
  ): Promise<PaymentIntentResponse>;
  confirmPaymentIntent(
    walletAddress: string,
    intentId: string,
    confirmations?: number,
  ): Promise<PaymentIntentResponse>;
  createPaymentIntent(
    walletAddress: string,
    payload: PaymentIntentDraftInput,
    idempotencyKey: string,
  ): Promise<PaymentIntentResponse>;
  quotePaymentIntent(
    walletAddress: string,
    payload: PaymentIntentQuoteInput,
  ): Promise<PaymentIntentQuoteResponse>;
  listContacts(walletAddress: string): Promise<ContactResponse[]>;
  createContact(
    walletAddress: string,
    payload: ContactCreateInput,
  ): Promise<ContactResponse>;
  deleteContact(
    walletAddress: string,
    contactId: string,
  ): Promise<ContactDeleteResponse>;
}

function walletHeaders(walletAddress: string) {
  return {
    "x-wallet-address": walletAddress,
  };
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Production API request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function createProductionApiClient(): ProductionApiClient {
  return {
    async getPortfolio(walletAddress) {
      const response = await fetch(`${API_BASE}/portfolio`, {
        headers: walletHeaders(walletAddress),
      });
      return readJson<PortfolioResponse>(response);
    },
    async listPaymentIntents(walletAddress, params) {
      const query = new URLSearchParams();
      if (params?.limit) {
        query.set("limit", String(params.limit));
      }
      if (params?.status) {
        query.set("status", params.status);
      }
      if (params?.chain) {
        query.set("chain", params.chain);
      }
      const suffix = query.toString() ? `?${query.toString()}` : "";
      const response = await fetch(`${API_BASE}/payment-intents${suffix}`, {
        headers: walletHeaders(walletAddress),
      });
      return readJson<PaymentIntentResponse[]>(response);
    },
    async listActivityEvents(walletAddress, limit = 30) {
      const query = new URLSearchParams();
      query.set("limit", String(limit));
      const response = await fetch(`${API_BASE}/activity?${query.toString()}`, {
        headers: walletHeaders(walletAddress),
      });
      return readJson<ActivityEventResponse[]>(response);
    },
    async submitPaymentIntent(walletAddress, intentId) {
      const response = await fetch(`${API_BASE}/payment-intents/${intentId}/submit`, {
        method: "POST",
        headers: walletHeaders(walletAddress),
      });
      return readJson<PaymentIntentResponse>(response);
    },
    async confirmPaymentIntent(walletAddress, intentId, confirmations = 1) {
      const response = await fetch(`${API_BASE}/payment-intents/${intentId}/confirm`, {
        method: "POST",
        headers: {
          ...walletHeaders(walletAddress),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirmations }),
      });
      return readJson<PaymentIntentResponse>(response);
    },
    async createPaymentIntent(walletAddress, payload, idempotencyKey) {
      const response = await fetch(`${API_BASE}/payment-intents`, {
        method: "POST",
        headers: {
          ...walletHeaders(walletAddress),
          "Idempotency-Key": idempotencyKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      return readJson<PaymentIntentResponse>(response);
    },
    async quotePaymentIntent(walletAddress, payload) {
      const response = await fetch(`${API_BASE}/payment-intents/quote`, {
        method: "POST",
        headers: {
          ...walletHeaders(walletAddress),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      return readJson<PaymentIntentQuoteResponse>(response);
    },
    async listContacts(walletAddress) {
      const response = await fetch(`${API_BASE}/contacts`, {
        headers: walletHeaders(walletAddress),
      });
      return readJson<ContactResponse[]>(response);
    },
    async createContact(walletAddress, payload) {
      const response = await fetch(`${API_BASE}/contacts`, {
        method: "POST",
        headers: {
          ...walletHeaders(walletAddress),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      return readJson<ContactResponse>(response);
    },
    async deleteContact(walletAddress, contactId) {
      const response = await fetch(`${API_BASE}/contacts/${contactId}`, {
        method: "DELETE",
        headers: walletHeaders(walletAddress),
      });
      return readJson<ContactDeleteResponse>(response);
    },
  };
}
