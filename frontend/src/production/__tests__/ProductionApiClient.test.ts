import { afterEach, describe, expect, it, vi } from "vitest";

import { createProductionApiClient } from "../api";

const OWNER = "0x" + "a".repeat(40);

function okJson(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createProductionApiClient", () => {
  it("builds payment-intent list query params correctly", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(okJson([]));

    const api = createProductionApiClient();
    await api.listPaymentIntents(OWNER, {
      limit: 20,
      status: "submitted",
      chain: "base",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];

    expect(String(url)).toContain("/api/v1/payment-intents?");
    expect(String(url)).toContain("limit=20");
    expect(String(url)).toContain("status=submitted");
    expect(String(url)).toContain("chain=base");
    expect((init as RequestInit).headers).toMatchObject({
      "x-wallet-address": OWNER,
    });
  });

  it("sends idempotency and json headers when creating a payment intent", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      okJson({
        id: "intent_1",
        senderWallet: OWNER,
        recipient: "0x" + "b".repeat(40),
        amount: "12.00",
        asset: "USDC",
        chain: "base",
        status: "draft",
        riskDecision: "allow",
        note: null,
        txHash: null,
        confirmations: 0,
        receiptUrl: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
    );

    const api = createProductionApiClient();
    await api.createPaymentIntent(
      OWNER,
      {
        recipient: "0x" + "b".repeat(40),
        amount: "12.00",
        chainPreference: "base",
      },
      "idem-123",
    );

    const [, init] = fetchMock.mock.calls[0];
    const headers = (init as RequestInit).headers as Record<string, string>;

    expect((init as RequestInit).method).toBe("POST");
    expect(headers["x-wallet-address"]).toBe(OWNER);
    expect(headers["Idempotency-Key"]).toBe("idem-123");
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("throws a useful error when the API returns a non-OK response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 503 }),
    );

    const api = createProductionApiClient();

    await expect(api.getPortfolio(OWNER)).rejects.toThrow(
      "Production API request failed with 503",
    );
  });
});
