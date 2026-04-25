import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ProductionWalletApp } from "../ProductionWalletApp";
import type {
  PaymentIntentResponse,
  PortfolioResponse,
  ProductionApiClient,
} from "../api";

const OWNER = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const RECIPIENT = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

const originalBlob = globalThis.Blob;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;
const originalConsoleError = console.error;
const createObjectUrlMock = vi.fn(() => "blob:activity");
const revokeObjectUrlMock = vi.fn();

class TestBlob {
  type: string;
  size: number;
  private readonly _content: string;

  constructor(parts: Array<string | BlobPart>, options?: BlobPropertyBag) {
    this._content = parts.map((part) => String(part)).join("");
    this.type = options?.type ?? "";
    this.size = this._content.length;
  }

  async text() {
    return this._content;
  }
}

function computeChecksum(rows: Array<Record<string, string>>) {
  let hash = 0x811c9dc5;
  const serialized = JSON.stringify(rows);
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

beforeAll(() => {
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    const [first] = args;
    if (
      typeof first === "string" &&
      first.includes("Not implemented: navigation to another Document")
    ) {
      return;
    }
    originalConsoleError(...(args as Parameters<typeof console.error>));
  });

  Object.defineProperty(globalThis, "Blob", {
    configurable: true,
    writable: true,
    value: TestBlob,
  });

  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: createObjectUrlMock,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    writable: true,
    value: revokeObjectUrlMock,
  });
});

beforeEach(() => {
  createObjectUrlMock.mockClear();
  revokeObjectUrlMock.mockClear();
});

afterAll(() => {
  vi.restoreAllMocks();

  Object.defineProperty(globalThis, "Blob", {
    configurable: true,
    writable: true,
    value: originalBlob,
  });

  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: originalCreateObjectURL,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    writable: true,
    value: originalRevokeObjectURL,
  });
});

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
  const createPaymentIntent = vi.fn(
    async (): Promise<PaymentIntentResponse> => ({
      id: "intent_123",
      senderWallet: OWNER,
      recipient: RECIPIENT,
      amount: "12.50",
      asset: "USDC",
      chain: "base",
      status: "draft",
      riskDecision: "allow",
      note: "Dinner",
      txHash: null,
      confirmations: 0,
      receiptUrl: null,
      createdAt: "2026-04-24T12:00:00.000Z",
      updatedAt: "2026-04-24T12:00:00.000Z",
    }),
  );
  const listPaymentIntents = vi.fn(async (): Promise<PaymentIntentResponse[]> => []);
  const listContacts = vi.fn(async () => []);
  const submitPaymentIntent = vi.fn(async (): Promise<PaymentIntentResponse> => ({
    id: "intent_123",
    senderWallet: OWNER,
    recipient: RECIPIENT,
    amount: "12.50",
    asset: "USDC",
    chain: "base",
    status: "submitted",
    riskDecision: "allow",
    note: "Dinner",
    txHash: "0xabc",
    confirmations: 0,
    receiptUrl: null,
    createdAt: "2026-04-24T12:00:00.000Z",
    updatedAt: "2026-04-24T12:05:00.000Z",
  }));
  const confirmPaymentIntent = vi.fn(async (): Promise<PaymentIntentResponse> => ({
    id: "intent_123",
    senderWallet: OWNER,
    recipient: RECIPIENT,
    amount: "12.50",
    asset: "USDC",
    chain: "base",
    status: "confirmed",
    riskDecision: "allow",
    note: "Dinner",
    txHash: "0xabc",
    confirmations: 1,
    receiptUrl: "https://example/receipt",
    createdAt: "2026-04-24T12:00:00.000Z",
    updatedAt: "2026-04-24T12:10:00.000Z",
  }));
  const deleteContact = vi.fn(async () => ({ deleted: true, contactId: "contact_123" }));
  const quotePaymentIntent = vi.fn(async () => ({
    recipient: RECIPIENT,
    amount: "12.50",
    asset: "USDC" as const,
    chain: "base" as const,
    riskDecision: "allow" as const,
    estimatedNetworkFee: "0.22",
    estimatedSettlementAmount: "12.28",
    policyNotice: null,
    dailyLimitUsdc: "500.00",
    dailySpentUsdc: "50.00",
    dailyAvailableUsdc: "450.00",
  }));
  const listActivityEvents = vi.fn(async () => [
    {
      id: "event_1",
      kind: "intent_created" as const,
      intentId: "intent_123",
      chain: "base" as const,
      asset: "USDC" as const,
      amount: "12.50",
      status: "draft" as const,
      txHash: null,
      receiptUrl: null,
      webhookSource: null,
      webhookType: null,
      occurredAt: "2026-04-24T12:00:00.000Z",
    },
    {
      id: "event_2",
      kind: "tx_submitted" as const,
      intentId: "intent_123",
      chain: "base" as const,
      asset: "USDC" as const,
      amount: "12.50",
      status: "submitted" as const,
      txHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      receiptUrl: null,
      webhookSource: null,
      webhookType: null,
      occurredAt: "2026-04-24T12:02:00.000Z",
    },
    {
      id: "event_3",
      kind: "receipt_issued" as const,
      intentId: "intent_123",
      chain: "base" as const,
      asset: "USDC" as const,
      amount: "12.50",
      status: "confirmed" as const,
      txHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      receiptUrl: "https://example/receipt/intent_123",
      webhookSource: null,
      webhookType: null,
      occurredAt: "2026-04-24T12:03:00.000Z",
    },
    {
      id: "event_4",
      kind: "webhook_received" as const,
      intentId: "intent_123",
      chain: "base" as const,
      asset: "USDC" as const,
      amount: "12.50",
      status: "confirmed" as const,
      txHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      receiptUrl: null,
      webhookSource: "alchemy",
      webhookType: "MINED_TRANSACTION",
      occurredAt: "2026-04-24T12:04:00.000Z",
    },
    {
      id: "event_5",
      kind: "webhook_received" as const,
      intentId: "intent_123",
      chain: "base" as const,
      asset: "USDC" as const,
      amount: "12.50",
      status: "confirmed" as const,
      txHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
      receiptUrl: null,
      webhookSource: " CIRCLE ",
      webhookType: "TRANSFER_CONFIRMED",
      occurredAt: "2026-04-24T11:58:00.000Z",
    },
    {
      id: "event_6",
      kind: "webhook_received" as const,
      intentId: "intent_123",
      chain: "base" as const,
      asset: "USDC" as const,
      amount: "12.50",
      status: "confirmed" as const,
      txHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      receiptUrl: null,
      webhookSource: "alchemy",
      webhookType: "MINED_TRANSACTION",
      occurredAt: "2026-04-24T12:04:00.000Z",
    },
  ]);

  return {
    getPortfolio,
    listPaymentIntents,
    submitPaymentIntent,
    confirmPaymentIntent,
    createPaymentIntent,
    quotePaymentIntent,
    listActivityEvents,
    listContacts,
    async createContact() {
      return {
        id: "contact_123",
        ownerWallet: OWNER,
        label: "Maya",
        walletAddress: RECIPIENT,
      };
    },
    deleteContact,
  };
}

describe("ProductionWalletApp", () => {
  it("renders a production smart-wallet payment shell without wallet secrets", async () => {
    render(<ProductionWalletApp apiClient={fakeApi()} initialWalletAddress={OWNER} />);

    expect(await screen.findByText("Production payments")).toBeInTheDocument();
    expect(screen.getByText("USDC only")).toBeInTheDocument();
    expect(screen.getByText("Base")).toBeInTheDocument();
    expect(screen.getByText("Arbitrum")).toBeInTheDocument();
    expect(screen.getByText("Polygon")).toBeInTheDocument();
    expect(screen.getByText("Settlement activity")).toBeInTheDocument();
    expect(screen.queryByLabelText(/private key/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  });

  it("creates a payment intent and shows a receipt-ready draft", async () => {
    const api = fakeApi();
    render(<ProductionWalletApp apiClient={api} initialWalletAddress={OWNER} />);

    await userEvent.type(await screen.findByLabelText("Recipient address"), RECIPIENT);
    await userEvent.type(screen.getByLabelText("Amount"), "12.50");
    await userEvent.type(screen.getByLabelText("Note"), "Dinner");
    await userEvent.click(screen.getByRole("button", { name: /prepare usdc payment/i }));

    await waitFor(() => {
      expect(api.createPaymentIntent).toHaveBeenCalledWith(
        OWNER,
        {
          recipient: RECIPIENT,
          amount: "12.50",
          chainPreference: "base",
          note: "Dinner",
        },
        expect.any(String),
      );
    });
    expect(screen.getByText("Payment intent ready")).toBeInTheDocument();
    expect(screen.getAllByText("intent_123").length).toBeGreaterThan(0);
  });

  it("previews a payment quote before intent creation", async () => {
    const api = fakeApi();
    render(<ProductionWalletApp apiClient={api} initialWalletAddress={OWNER} />);

    await userEvent.type(await screen.findByLabelText("Recipient address"), RECIPIENT);
    await userEvent.type(screen.getByLabelText("Amount"), "12.50");
    await userEvent.click(screen.getByRole("button", { name: /preview quote/i }));

    await waitFor(() => {
      expect(api.quotePaymentIntent).toHaveBeenCalledWith(OWNER, {
        recipient: RECIPIENT,
        amount: "12.50",
        chainPreference: "base",
      });
    });

    expect(screen.getByText(/estimated network fee/i)).toBeInTheDocument();
    expect(screen.getByText(/risk decision: allow/i)).toBeInTheDocument();
  });

  it("renders settlement activity events with tx and receipt details", async () => {
    render(<ProductionWalletApp apiClient={fakeApi()} initialWalletAddress={OWNER} />);

    expect(await screen.findByText("Transaction submitted")).toBeInTheDocument();
    expect(screen.getByText("Receipt issued")).toBeInTheDocument();
    expect(screen.getAllByText("Webhook received").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/tx:/i).length).toBeGreaterThan(0);

    const settlementSection = screen.getByText("Settlement activity").closest("section");
    expect(settlementSection).not.toBeNull();

    const eventOrder = within(settlementSection as HTMLElement)
      .getAllByText(/Intent created|Transaction submitted|Receipt issued|Webhook received/)
      .map((node) => node.textContent);
    expect(eventOrder.slice(0, 3)).toEqual([
      "Webhook received",
      "Receipt issued",
      "Transaction submitted",
    ]);

    expect(screen.getByText(/Source: alchemy/i)).toBeInTheDocument();
    expect(screen.getByText(/MINED_TRANSACTION/)).toBeInTheDocument();

    const receiptLink = screen.getByRole("link", { name: "View receipt" });
    expect(receiptLink).toHaveAttribute("href", "https://example/receipt/intent_123");
  });

  it("filters settlement activity by kind and provider source while deduping duplicates", async () => {
    render(<ProductionWalletApp apiClient={fakeApi()} initialWalletAddress={OWNER} />);

    const webhookRows = await screen.findAllByText("Webhook received");
    expect(webhookRows.length).toBe(2);

    // Duplicate alchemy webhook events should collapse into one rendered card.
    expect(screen.getAllByText("Webhook received").length).toBe(2);

    await userEvent.click(screen.getByRole("button", { name: "Webhooks" }));
    await userEvent.click(screen.getByRole("button", { name: "Circle" }));

    expect(screen.getByText(/Source: circle/i)).toBeInTheDocument();
    expect(screen.queryByText(/Source: alchemy/i)).not.toBeInTheDocument();
  });

  it("shows activity summary stats and clears filters back to the full feed", async () => {
    render(<ProductionWalletApp apiClient={fakeApi()} initialWalletAddress={OWNER} />);

    expect(await screen.findByText(/Showing 5 events/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Receipts" }));
    expect(screen.getByText(/Showing 1 event/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Clear filters/i }));

    expect(screen.getByText(/Showing 5 events/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Clear filters/i })).not.toBeInTheDocument();
  });

  it("exports settlement activity as JSON and CSV", async () => {
    render(<ProductionWalletApp apiClient={fakeApi()} initialWalletAddress={OWNER} />);

    expect(await screen.findByText(/Showing 5 events/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Export JSON" }));
    await userEvent.click(screen.getByRole("button", { name: "Export CSV" }));

    expect(createObjectUrlMock).toHaveBeenCalledTimes(2);
    expect(revokeObjectUrlMock).toHaveBeenCalledTimes(2);

    const jsonBlob = createObjectUrlMock.mock.calls[0][0] as Blob;
    const csvBlob = createObjectUrlMock.mock.calls[1][0] as Blob;

    const jsonText = await jsonBlob.text();
    const csvText = await csvBlob.text();

    const exportedJson = JSON.parse(jsonText) as {
      metadata: Record<string, string | number>;
      events: Array<Record<string, string>>;
    };
    expect(exportedJson.metadata.walletAddress).toBe(OWNER);
    expect(exportedJson.metadata.schemaVersion).toBe("activity-export.v1");
    expect(exportedJson.metadata.filterKind).toBe("all");
    expect(exportedJson.metadata.filterSource).toBe("all");
    expect(exportedJson.metadata.eventCount).toBe(5);
    expect(typeof exportedJson.metadata.generatedAtUtc).toBe("string");
    expect(typeof exportedJson.metadata.eventsChecksum).toBe("string");
    expect(String(exportedJson.metadata.eventsChecksum)).toMatch(/^fnv1a32:[0-9a-f]{8}$/);
    expect(exportedJson.metadata.eventsChecksum).toBe(computeChecksum(exportedJson.events));
    expect(exportedJson.metadata.kindCounts).toMatchObject({
      intent_created: 1,
      tx_submitted: 1,
      receipt_issued: 1,
      webhook_received: 2,
    });
    expect(exportedJson.metadata.sourceCounts).toMatchObject({
      ALCHEMY: 1,
      CIRCLE: 1,
      NONE: 3,
      OTHER: 0,
    });

    expect(exportedJson.events.length).toBe(5);
    expect(exportedJson.events[0].kind).toBe("webhook_received");
    expect(exportedJson.events.some((row) => row.webhookSource === "ALCHEMY")).toBe(true);
    expect(exportedJson.events.some((row) => row.webhookSource === "CIRCLE")).toBe(true);
    expect(exportedJson.events.every((row) => row.occurredAt.endsWith("Z"))).toBe(true);

    const csvLines = csvText.split("\n");
    expect(csvLines[0]).toBe("# schemaVersion,activity-export.v1");
    expect(csvLines[1]).toBe(`# walletAddress,${OWNER}`);
    expect(csvLines[3]).toBe("# filterKind,all");
    expect(csvLines[4]).toBe("# filterSource,all");
    expect(csvLines[5]).toBe("# eventCount,5");
    expect(csvLines[6]).toBe(`# eventsChecksum,${exportedJson.metadata.eventsChecksum}`);
    expect(csvLines[7]).toBe("# kindCounts.intent_created,1");
    expect(csvLines[10]).toBe("# kindCounts.webhook_received,2");
    expect(csvLines[11]).toBe("# sourceCounts.ALCHEMY,1");
    expect(csvLines[14]).toBe("# sourceCounts.OTHER,0");
    expect(csvLines[15]).toBe(
      "kind,intentId,chain,asset,amount,status,txHash,receiptUrl,webhookSource,webhookType,occurredAt",
    );
    expect(csvText.includes("ALCHEMY")).toBe(true);
    expect(csvText.includes("CIRCLE")).toBe(true);
  });

  it("exports snapshot metadata that matches active filters", async () => {
    render(<ProductionWalletApp apiClient={fakeApi()} initialWalletAddress={OWNER} />);

    expect(await screen.findByText(/Showing 5 events/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Webhooks" }));
    await userEvent.click(screen.getByRole("button", { name: "Circle" }));
    expect(screen.getByText(/Showing 1 event/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Export JSON" }));

    const jsonBlob = createObjectUrlMock.mock.calls[0][0] as { text: () => Promise<string> };
    const jsonText = await jsonBlob.text();
    const exportedJson = JSON.parse(jsonText) as {
      metadata: Record<string, string | number>;
      events: Array<Record<string, string>>;
    };

    expect(exportedJson.metadata.filterKind).toBe("webhook_received");
    expect(exportedJson.metadata.filterSource).toBe("circle");
    expect(exportedJson.metadata.schemaVersion).toBe("activity-export.v1");
    expect(exportedJson.metadata.eventCount).toBe(1);
    expect(String(exportedJson.metadata.eventsChecksum)).toMatch(/^fnv1a32:[0-9a-f]{8}$/);
    expect(exportedJson.metadata.eventsChecksum).toBe(computeChecksum(exportedJson.events));
    expect(exportedJson.metadata.kindCounts).toMatchObject({ webhook_received: 1 });
    expect(exportedJson.metadata.sourceCounts).toMatchObject({ CIRCLE: 1 });
    expect(exportedJson.events.length).toBe(1);
    expect(exportedJson.events[0].webhookSource).toBe("CIRCLE");
  });

  it("disables export actions when filters produce zero events", async () => {
    render(<ProductionWalletApp apiClient={fakeApi()} initialWalletAddress={OWNER} />);

    expect(await screen.findByText(/Showing 5 events/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Receipts" }));
    await userEvent.click(screen.getByRole("button", { name: "Circle" }));

    expect(screen.getByText(/No settlement events match your current filters/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export JSON" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Export CSV" })).toBeDisabled();
  });

  it("submits and confirms an existing draft intent", async () => {
    const existingIntent: PaymentIntentResponse = {
      id: "intent_draft",
      senderWallet: OWNER,
      recipient: RECIPIENT,
      amount: "18.00",
      asset: "USDC",
      chain: "base",
      status: "draft",
      riskDecision: "allow",
      note: "Ops payout",
      txHash: null,
      confirmations: 0,
      receiptUrl: null,
      createdAt: "2026-04-24T11:30:00.000Z",
      updatedAt: "2026-04-24T11:30:00.000Z",
    };

    const api = fakeApi();
    api.listPaymentIntents = vi.fn(async () => [existingIntent]);
    api.submitPaymentIntent = vi.fn(async () => ({
      ...existingIntent,
      status: "submitted",
      txHash: "0xabc",
    }));
    api.confirmPaymentIntent = vi.fn(async () => ({
      ...existingIntent,
      status: "confirmed",
      txHash: "0xabc",
      confirmations: 1,
      receiptUrl: "https://example/receipt",
    }));

    render(<ProductionWalletApp apiClient={api} initialWalletAddress={OWNER} />);

    await userEvent.click(await screen.findByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(api.submitPaymentIntent).toHaveBeenCalledWith(OWNER, "intent_draft");
    });

    await userEvent.click(await screen.findByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(api.confirmPaymentIntent).toHaveBeenCalledWith(OWNER, "intent_draft", 1);
    });

    expect(screen.getByText("confirmed")).toBeInTheDocument();
  });

  it("deletes a saved contact from the address book", async () => {
    const contact = {
      id: "contact_123",
      ownerWallet: OWNER,
      label: "Maya",
      walletAddress: RECIPIENT,
    };

    const api = fakeApi();
    api.listContacts = vi
      .fn()
      .mockResolvedValueOnce([contact])
      .mockResolvedValueOnce([]);
    api.deleteContact = vi.fn(async () => ({ deleted: true, contactId: "contact_123" }));

    render(<ProductionWalletApp apiClient={api} initialWalletAddress={OWNER} />);

    expect(await screen.findByText("Maya")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => {
      expect(api.deleteContact).toHaveBeenCalledWith(OWNER, "contact_123");
    });

    await waitFor(() => {
      expect(screen.queryByText("Maya")).not.toBeInTheDocument();
    });
  });
});
