import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProductionPaymentsPage } from "../../pages/Payments";
import type {
  PaymentIntentResponse,
  PortfolioResponse,
  ProductionApiClient,
} from "../api";

const OWNER = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function fakeApi(): ProductionApiClient {
  const getPortfolio = vi.fn(
    async (walletAddress: string): Promise<PortfolioResponse> => ({
      walletAddress,
      balances: [
        {
          chain: "base",
          asset: "USDC",
          amount: "0.00",
          contractAddress: "0x0000000000000000000000000000000000000000",
        },
        {
          chain: "arbitrum",
          asset: "USDC",
          amount: "0.00",
          contractAddress: "0x0000000000000000000000000000000000000000",
        },
        {
          chain: "polygon",
          asset: "USDC",
          amount: "0.00",
          contractAddress: "0x0000000000000000000000000000000000000000",
        },
      ],
    }),
  );

  const fakeIntent: PaymentIntentResponse = {
    id: "intent_123",
    senderWallet: OWNER,
    recipient: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    amount: "10.00",
    asset: "USDC",
    chain: "base",
    status: "draft",
    riskDecision: "allow",
    note: null,
    txHash: null,
    confirmations: 0,
    receiptUrl: null,
    createdAt: "2026-04-24T11:30:00.000Z",
    updatedAt: "2026-04-24T11:30:00.000Z",
  };

  return {
    getPortfolio,
    listPaymentIntents: vi.fn(async () => []),
    listActivityEvents: vi.fn(async () => []),
    submitPaymentIntent: vi.fn(async (): Promise<PaymentIntentResponse> => ({
      ...fakeIntent,
      status: "submitted" as const,
    })),
    confirmPaymentIntent: vi.fn(async (): Promise<PaymentIntentResponse> => ({
      ...fakeIntent,
      status: "confirmed" as const,
      confirmations: 1,
      txHash: "0xabc",
      receiptUrl: "https://example/receipt",
    })),
    createPaymentIntent: vi.fn(async () => fakeIntent),
    quotePaymentIntent: vi.fn(async () => ({
      recipient: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      amount: "10.00",
      asset: "USDC" as const,
      chain: "base" as const,
      riskDecision: "allow" as const,
      estimatedNetworkFee: "0.22",
      estimatedSettlementAmount: "9.78",
      policyNotice: null,
      dailyLimitUsdc: "500.00",
      dailySpentUsdc: "25.00",
      dailyAvailableUsdc: "475.00",
    })),
    listContacts: vi.fn(async () => []),
    createContact: vi.fn(async () => ({
      id: "contact_123",
      ownerWallet: OWNER,
      label: "Maya",
      walletAddress: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    })),
    deleteContact: vi.fn(async () => ({ deleted: true, contactId: "contact_123" })),
  };
}

describe("ProductionPaymentsPage", () => {
  it("prompts for a dashboard wallet when no wallet is stored locally", async () => {
    localStorage.removeItem("bw_wallet");

    render(<ProductionPaymentsPage apiClient={fakeApi()} />);

    expect(
      screen.getByText("Create a wallet on the Dashboard first to unlock production payments."),
    ).toBeInTheDocument();
  });

  it("renders the production wallet app when a wallet address is stored", async () => {
    localStorage.setItem("bw_wallet", JSON.stringify({ address: OWNER }));

    render(<ProductionPaymentsPage apiClient={fakeApi()} />);

    expect(await screen.findByText("Production payments")).toBeInTheDocument();
  });
});
