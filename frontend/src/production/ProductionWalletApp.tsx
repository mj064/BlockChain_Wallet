import { FormEvent, useEffect, useId, useMemo, useState } from "react";

import type {
  ActivityEventResponse,
  ContactResponse,
  PaymentIntentResponse,
  PaymentIntentQuoteResponse,
  PortfolioResponse,
  ProductionApiClient,
  SupportedChain,
} from "./api";

type Props = {
  apiClient: ProductionApiClient;
  initialWalletAddress: string;
};

const CHAIN_LABELS: Record<SupportedChain, string> = {
  base: "Base",
  arbitrum: "Arbitrum",
  polygon: "Polygon",
};

const TIMELINE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatTimelineTime(value: string) {
  return TIMELINE_FORMATTER.format(new Date(value));
}

function csvEscape(value: string) {
  if (value.includes(",") || value.includes("\n") || value.includes('"')) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

type ActivityExportRow = {
  kind: string;
  intentId: string;
  chain: string;
  asset: string;
  amount: string;
  status: string;
  txHash: string;
  receiptUrl: string;
  webhookSource: string;
  webhookType: string;
  occurredAt: string;
};

type ActivityExportMetadata = {
  schemaVersion: string;
  walletAddress: string;
  generatedAtUtc: string;
  filterKind: string;
  filterSource: string;
  eventCount: number;
  eventsChecksum: string;
  kindCounts: Record<string, number>;
  sourceCounts: Record<string, number>;
};

function computeChecksum(rows: ActivityExportRow[]) {
  // FNV-1a 32-bit hash for deterministic, lightweight client-side checksums.
  let hash = 0x811c9dc5;
  const serialized = JSON.stringify(rows);
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function normalizeWebhookSource(value: string | null) {
  if (!value) {
    return "NONE";
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "alchemy") {
    return "ALCHEMY";
  }
  if (normalized === "circle") {
    return "CIRCLE";
  }
  return "OTHER";
}

function normalizeWebhookSourceFilter(value: "all" | "alchemy" | "circle") {
  if (value === "all") {
    return "all";
  }
  return value.toUpperCase();
}

function normalizeTimestamp(value: string) {
  const parsed = Date.parse(value);
  if (Number.isFinite(parsed)) {
    return new Date(parsed).toISOString();
  }
  return value;
}

function compareExportRows(left: ActivityExportRow, right: ActivityExportRow) {
  const timeDelta = Date.parse(right.occurredAt) - Date.parse(left.occurredAt);
  if (timeDelta !== 0) {
    return timeDelta;
  }

  const keys: Array<keyof ActivityExportRow> = [
    "kind",
    "intentId",
    "chain",
    "asset",
    "amount",
    "status",
    "txHash",
    "receiptUrl",
    "webhookSource",
    "webhookType",
  ];

  for (const key of keys) {
    const comparison = left[key].localeCompare(right[key]);
    if (comparison !== 0) {
      return comparison;
    }
  }

  return 0;
}

function buildActivityExportRows(events: ActivityEventResponse[]): ActivityExportRow[] {
  return events
    .map((event) => ({
      kind: event.kind,
      intentId: event.intentId,
      chain: event.chain,
      asset: event.asset,
      amount: event.amount,
      status: event.status ?? "unknown",
      txHash: event.txHash ?? "",
      receiptUrl: event.receiptUrl ?? "",
      webhookSource: normalizeWebhookSource(event.webhookSource),
      webhookType: event.webhookType ?? "",
      occurredAt: normalizeTimestamp(event.occurredAt),
    }))
    .sort(compareExportRows);
}

function buildActivityExportMetadata(
  schemaVersion: string,
  walletAddress: string,
  generatedAtUtc: string,
  filterKind: string,
  filterSource: string,
  eventCount: number,
  eventsChecksum: string,
  kindCounts: Record<string, number>,
  sourceCounts: Record<string, number>,
): ActivityExportMetadata {
  return {
    schemaVersion,
    walletAddress,
    generatedAtUtc,
    filterKind,
    filterSource,
    eventCount,
    eventsChecksum,
    kindCounts,
    sourceCounts,
  };
}

function buildActivityCsv(events: ActivityEventResponse[], metadata: ActivityExportMetadata) {
  const header = [
    "kind",
    "intentId",
    "chain",
    "asset",
    "amount",
    "status",
    "txHash",
    "receiptUrl",
    "webhookSource",
    "webhookType",
    "occurredAt",
  ];

  const rows = buildActivityExportRows(events).map((row) => [
    row.kind,
    row.intentId,
    row.chain,
    row.asset,
    row.amount,
    row.status,
    row.txHash,
    row.receiptUrl,
    row.webhookSource,
    row.webhookType,
    row.occurredAt,
  ]);

  const metadataRows = [
    ["# schemaVersion", metadata.schemaVersion],
    ["# walletAddress", metadata.walletAddress],
    ["# generatedAtUtc", metadata.generatedAtUtc],
    ["# filterKind", metadata.filterKind],
    ["# filterSource", metadata.filterSource],
    ["# eventCount", String(metadata.eventCount)],
    ["# eventsChecksum", metadata.eventsChecksum],
    ["# kindCounts.intent_created", String(metadata.kindCounts.intent_created ?? 0)],
    ["# kindCounts.tx_submitted", String(metadata.kindCounts.tx_submitted ?? 0)],
    ["# kindCounts.receipt_issued", String(metadata.kindCounts.receipt_issued ?? 0)],
    ["# kindCounts.webhook_received", String(metadata.kindCounts.webhook_received ?? 0)],
    ["# sourceCounts.ALCHEMY", String(metadata.sourceCounts.ALCHEMY ?? 0)],
    ["# sourceCounts.CIRCLE", String(metadata.sourceCounts.CIRCLE ?? 0)],
    ["# sourceCounts.NONE", String(metadata.sourceCounts.NONE ?? 0)],
    ["# sourceCounts.OTHER", String(metadata.sourceCounts.OTHER ?? 0)],
  ];

  return [...metadataRows, header, ...rows]
    .map((row) => row.map((value) => csvEscape(String(value))).join(","))
    .join("\n");
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

function makeIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `intent-${Date.now()}`;
}

export function ProductionWalletApp({
  apiClient,
  initialWalletAddress,
}: Props) {
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [intents, setIntents] = useState<PaymentIntentResponse[]>([]);
  const [activityEvents, setActivityEvents] = useState<ActivityEventResponse[]>([]);
  const [contacts, setContacts] = useState<ContactResponse[]>([]);
  const [form, setForm] = useState({
    recipient: "",
    amount: "",
    note: "",
    chainPreference: "base" as SupportedChain,
  });
  const [contactForm, setContactForm] = useState({ label: "", walletAddress: "" });
  const [intent, setIntent] = useState<PaymentIntentResponse | null>(null);
  const [quote, setQuote] = useState<PaymentIntentQuoteResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [contactSaving, setContactSaving] = useState(false);
  const [intentActionId, setIntentActionId] = useState<string | null>(null);
  const [activityKindFilter, setActivityKindFilter] = useState<
    "all" | ActivityEventResponse["kind"]
  >("all");
  const [activitySourceFilter, setActivitySourceFilter] = useState<
    "all" | "alchemy" | "circle"
  >("all");
  const [error, setError] = useState<string | null>(null);

  const headingId = useId();

  async function refreshWalletState() {
    const [nextPortfolio, nextIntents, nextContacts, nextEvents] = await Promise.all([
      apiClient.getPortfolio(initialWalletAddress),
      apiClient.listPaymentIntents(initialWalletAddress, { limit: 20 }),
      apiClient.listContacts(initialWalletAddress),
      apiClient.listActivityEvents(initialWalletAddress, 30),
    ]);
    setPortfolio(nextPortfolio);
    setIntents(nextIntents);
    setContacts(nextContacts);
    setActivityEvents(nextEvents);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadWalletState() {
      try {
        const [nextPortfolio, nextIntents, nextContacts, nextEvents] = await Promise.all([
          apiClient.getPortfolio(initialWalletAddress),
          apiClient.listPaymentIntents(initialWalletAddress, { limit: 20 }),
          apiClient.listContacts(initialWalletAddress),
          apiClient.listActivityEvents(initialWalletAddress, 30),
        ]);
        if (cancelled) {
          return;
        }
        setPortfolio(nextPortfolio);
        setIntents(nextIntents);
        setContacts(nextContacts);
        setActivityEvents(nextEvents);
      } catch {
        if (!cancelled) {
          setError("Unable to load production wallet data.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadWalletState();
    return () => {
      cancelled = true;
    };
  }, [apiClient, initialWalletAddress]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const nextIntent = await apiClient.createPaymentIntent(
        initialWalletAddress,
        {
          recipient: form.recipient,
          amount: form.amount,
          chainPreference: form.chainPreference,
          note: form.note || undefined,
        },
        makeIdempotencyKey(),
      );
      setIntent(nextIntent);
      setIntents((current) => [nextIntent, ...current.filter((item) => item.id !== nextIntent.id)]);
      setForm((current) => ({
        ...current,
        amount: "",
        note: "",
      }));
    } catch {
      setError("Unable to prepare the USDC payment intent.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleQuotePreview() {
    setError(null);
    setQuoting(true);
    try {
      const nextQuote = await apiClient.quotePaymentIntent(initialWalletAddress, {
        recipient: form.recipient,
        amount: form.amount,
        chainPreference: form.chainPreference,
      });
      setQuote(nextQuote);
    } catch {
      setError("Unable to generate payment quote.");
    } finally {
      setQuoting(false);
    }
  }

  async function handleCreateContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setContactSaving(true);

    try {
      await apiClient.createContact(initialWalletAddress, contactForm);
      setContactForm({ label: "", walletAddress: "" });
      const nextContacts = await apiClient.listContacts(initialWalletAddress);
      setContacts(nextContacts);
    } catch {
      setError("Unable to save contact.");
    } finally {
      setContactSaving(false);
    }
  }

  async function handleDeleteContact(contactId: string) {
    setError(null);
    setSyncing(true);
    try {
      await apiClient.deleteContact(initialWalletAddress, contactId);
      const nextContacts = await apiClient.listContacts(initialWalletAddress);
      setContacts(nextContacts);
    } catch {
      setError("Unable to remove contact.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleSubmitIntent(intentId: string) {
    setError(null);
    setIntentActionId(intentId);
    try {
      const updated = await apiClient.submitPaymentIntent(initialWalletAddress, intentId);
      setIntents((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setIntent((current) => (current?.id === updated.id ? updated : current));
    } catch {
      setError("Unable to submit payment intent.");
    } finally {
      setIntentActionId(null);
    }
  }

  async function handleConfirmIntent(intentId: string) {
    setError(null);
    setIntentActionId(intentId);
    try {
      const updated = await apiClient.confirmPaymentIntent(
        initialWalletAddress,
        intentId,
        1,
      );
      setIntents((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setIntent((current) => (current?.id === updated.id ? updated : current));
    } catch {
      setError("Unable to confirm payment intent.");
    } finally {
      setIntentActionId(null);
    }
  }

  function applyContact(contact: ContactResponse) {
    setForm((current) => ({
      ...current,
      recipient: contact.walletAddress,
    }));
  }

  const statusColors: Record<string, string> = {
    draft: "#93C5FD",
    submitted: "#FCD34D",
    confirmed: "#34D399",
    failed: "#F87171",
    expired: "#9CA3AF",
  };

  const eventLabels: Record<string, string> = {
    intent_created: "Intent created",
    tx_submitted: "Transaction submitted",
    receipt_issued: "Receipt issued",
    webhook_received: "Webhook received",
  };

  const eventColors: Record<string, string> = {
    intent_created: "#93C5FD",
    tx_submitted: "#FCD34D",
    receipt_issued: "#34D399",
    webhook_received: "#22D3EE",
  };

  const sortedActivityEvents = useMemo(() => {
    const seen = new Set<string>();
    const deduped: ActivityEventResponse[] = [];
    for (const event of activityEvents) {
      const key = [
        event.kind,
        event.intentId,
        event.txHash ?? "",
        event.receiptUrl ?? "",
        normalizeWebhookSource(event.webhookSource),
        event.webhookType ?? "",
        event.occurredAt,
      ].join("|");
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      deduped.push(event);
    }
    return deduped.sort(
      (left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt),
    );
  }, [activityEvents]);

  const filteredActivityEvents = useMemo(() => {
    const normalizedFilterSource = normalizeWebhookSourceFilter(activitySourceFilter);
    return sortedActivityEvents.filter((event) => {
      if (activityKindFilter !== "all" && event.kind !== activityKindFilter) {
        return false;
      }
      if (normalizedFilterSource === "all") {
        return true;
      }
      return normalizeWebhookSource(event.webhookSource) === normalizedFilterSource;
    });
  }, [activityKindFilter, activitySourceFilter, sortedActivityEvents]);

  const activityStats = useMemo(() => {
    return filteredActivityEvents.reduce(
      (accumulator, event) => {
        accumulator.total += 1;
        accumulator.kinds[event.kind] = (accumulator.kinds[event.kind] ?? 0) + 1;
        if (event.webhookSource) {
          accumulator.sources[event.webhookSource] =
            (accumulator.sources[event.webhookSource] ?? 0) + 1;
        }
        return accumulator;
      },
      {
        total: 0,
        kinds: {} as Record<string, number>,
        sources: {} as Record<string, number>,
      },
    );
  }, [filteredActivityEvents]);

  const hasActivityFilters =
    activityKindFilter !== "all" || activitySourceFilter !== "all";

  const exportRows = useMemo(
    () => buildActivityExportRows(filteredActivityEvents),
    [filteredActivityEvents],
  );

  const exportSnapshot = useMemo(() => {
    const kindCounts: Record<string, number> = {};
    const sourceCounts: Record<string, number> = {
      ALCHEMY: 0,
      CIRCLE: 0,
      NONE: 0,
      OTHER: 0,
    };

    for (const row of exportRows) {
      kindCounts[row.kind] = (kindCounts[row.kind] ?? 0) + 1;
      const normalizedSource = row.webhookSource;
      sourceCounts[normalizedSource] = (sourceCounts[normalizedSource] ?? 0) + 1;
    }

    return {
      eventCount: exportRows.length,
      eventsChecksum: computeChecksum(exportRows),
      kindCounts,
      sourceCounts,
    };
  }, [exportRows]);

  function buildExportMetadataNow(): ActivityExportMetadata {
    return buildActivityExportMetadata(
      "activity-export.v1",
      initialWalletAddress,
      new Date().toISOString(),
      activityKindFilter,
      activitySourceFilter,
      exportSnapshot.eventCount,
      exportSnapshot.eventsChecksum,
      exportSnapshot.kindCounts,
      exportSnapshot.sourceCounts,
    );
  }

  function handleExportActivityJson() {
    if (exportRows.length === 0) {
      return;
    }
    const metadata = buildExportMetadataNow();
    const payload = JSON.stringify(
      {
        metadata,
        events: exportRows,
      },
      null,
      2,
    );
    downloadTextFile("settlement-activity.json", payload, "application/json;charset=utf-8");
  }

  function handleExportActivityCsv() {
    if (exportRows.length === 0) {
      return;
    }
    const metadata = buildExportMetadataNow();
    const payload = buildActivityCsv(filteredActivityEvents, metadata);
    downloadTextFile("settlement-activity.csv", payload, "text/csv;charset=utf-8");
  }

  return (
    <section
      className="card"
      aria-labelledby={headingId}
      style={{
        maxWidth: 1120,
        margin: "0 auto",
        display: "grid",
        gap: 28,
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 24,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div>
          <p
            style={{
              color: "var(--accent-secondary)",
              fontSize: 13,
              letterSpacing: 1.4,
              textTransform: "uppercase",
              fontWeight: 700,
              marginBottom: 10,
            }}
          >
            Production payments
          </p>
          <h1 id={headingId} style={{ fontSize: 34, marginBottom: 10 }}>
            Smart-wallet USDC dispatch
          </h1>
          <p className="text-muted" style={{ maxWidth: 620, lineHeight: 1.6 }}>
            Prepare compliant payment drafts against the production wallet API
            without ever exposing private keys or local signing secrets in the
            browser.
          </p>
        </div>

        <div
          style={{
            minWidth: 260,
            padding: 18,
            borderRadius: 18,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid var(--glass-border)",
          }}
        >
          <div className="label">Wallet address</div>
          <div className="mono" style={{ fontSize: 13, wordBreak: "break-all" }}>
            {initialWalletAddress}
          </div>
          <div
            style={{
              marginTop: 14,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              borderRadius: 999,
              background: "rgba(6, 182, 212, 0.12)",
              color: "var(--accent-secondary)",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            USDC only
          </div>
        </div>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.3fr 1fr",
          gap: 24,
        }}
      >
        <div
          style={{
            display: "grid",
            gap: 16,
          }}
        >
          <div
            style={{
              padding: 24,
              borderRadius: 20,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid var(--glass-border)",
            }}
          >
            <div className="label">Available settlement rails</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 12,
                marginTop: 10,
              }}
            >
              {(portfolio?.balances ?? [
                { chain: "base" as SupportedChain, asset: "USDC", amount: "0.00", contractAddress: "" },
                { chain: "arbitrum" as SupportedChain, asset: "USDC", amount: "0.00", contractAddress: "" },
                { chain: "polygon" as SupportedChain, asset: "USDC", amount: "0.00", contractAddress: "" },
              ]).map((balance) => (
                <article
                  key={balance.chain}
                  style={{
                    padding: 16,
                    borderRadius: 16,
                    border: "1px solid var(--glass-border)",
                    background:
                      balance.chain === form.chainPreference
                        ? "linear-gradient(135deg, rgba(6, 182, 212, 0.16), rgba(139, 92, 246, 0.16))"
                        : "rgba(0,0,0,0.18)",
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>
                    {CHAIN_LABELS[balance.chain]}
                  </div>
                  <div className="text-muted" style={{ fontSize: 13 }}>
                    {balance.asset}
                  </div>
                  <div style={{ marginTop: 12, fontSize: 22, fontWeight: 800 }}>
                    {loading ? "…" : balance.amount}
                  </div>
                </article>
              ))}
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            style={{
              padding: 24,
              borderRadius: 20,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid var(--glass-border)",
            }}
          >
            <div className="form-group">
              <label className="label" htmlFor="production-recipient">
                Recipient address
              </label>
              <input
                id="production-recipient"
                className="input mono"
                value={form.recipient}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    recipient: event.target.value,
                  }))
                }
                placeholder="0x..."
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 200px",
                gap: 16,
              }}
            >
              <div className="form-group">
                <label className="label" htmlFor="production-amount">
                  Amount
                </label>
                <input
                  id="production-amount"
                  className="input"
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      amount: event.target.value,
                    }))
                  }
                  placeholder="0.00"
                />
              </div>

              <div className="form-group">
                <label className="label" htmlFor="production-chain">
                  Chain
                </label>
                <select
                  id="production-chain"
                  className="input"
                  value={form.chainPreference}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      chainPreference: event.target.value as SupportedChain,
                    }))
                  }
                >
                  {Object.entries(CHAIN_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label} network
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="label" htmlFor="production-note">
                Note
              </label>
              <input
                id="production-note"
                className="input"
                value={form.note}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    note: event.target.value,
                  }))
                }
                placeholder="Optional transfer memo"
              />
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                className="btn btn-secondary"
                type="button"
                disabled={quoting}
                onClick={handleQuotePreview}
              >
                {quoting ? "Quoting..." : "Preview quote"}
              </button>
              <button className="btn btn-primary" disabled={submitting}>
                {submitting ? "Preparing..." : "Prepare USDC payment"}
              </button>
            </div>

            {quote ? (
              <div
                style={{
                  marginTop: 14,
                  border: "1px solid var(--glass-border)",
                  borderRadius: 14,
                  padding: 12,
                  display: "grid",
                  gap: 6,
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <div className="label">Preflight quote</div>
                <div className="text-muted" style={{ fontSize: 13 }}>
                  Estimated network fee: {quote.estimatedNetworkFee} {quote.asset}
                </div>
                <div className="text-muted" style={{ fontSize: 13 }}>
                  Estimated settlement amount: {quote.estimatedSettlementAmount} {quote.asset}
                </div>

                <div style={{ marginTop: 8, borderTop: "1px solid var(--glass-border)", paddingTop: 8 }}>
                  <div className="text-muted" style={{ fontSize: 12, marginBottom: 6 }}>
                    Daily limit: {quote.dailySpentUsdc} / {quote.dailyLimitUsdc} USDC used
                  </div>
                  <div
                    style={{
                      height: 6,
                      borderRadius: 3,
                      background: "rgba(255,255,255,0.1)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(100, (parseFloat(quote.dailySpentUsdc) / parseFloat(quote.dailyLimitUsdc)) * 100)}%`,
                        background:
                          parseFloat(quote.dailySpentUsdc) / parseFloat(quote.dailyLimitUsdc) > 0.8
                            ? "#F87171"
                            : parseFloat(quote.dailySpentUsdc) / parseFloat(quote.dailyLimitUsdc) > 0.5
                              ? "#FCD34D"
                              : "var(--green)",
                        transition: "width 0.2s ease",
                      }}
                    />
                  </div>
                  <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
                    Available: {quote.dailyAvailableUsdc} {quote.asset}
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    color:
                      quote.riskDecision === "allow"
                        ? "var(--green)"
                        : quote.riskDecision === "warn"
                          ? "#FCD34D"
                          : "#F87171",
                  }}
                >
                  Risk decision: {quote.riskDecision}
                </div>
                {quote.policyNotice ? (
                  <div className="text-muted" style={{ fontSize: 12 }}>
                    {quote.policyNotice}
                  </div>
                ) : null}
              </div>
            ) : null}
          </form>
        </div>

        <aside
          style={{
            padding: 24,
            borderRadius: 20,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid var(--glass-border)",
            display: "grid",
            gap: 18,
            alignContent: "start",
          }}
        >
          <div>
            <div className="label">Compliance posture</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>
              No wallet secrets in browser
            </div>
            <p className="text-muted" style={{ marginTop: 8, lineHeight: 1.6 }}>
              This flow prepares backend-managed payment intents only. It does
              not ask for a password or private key.
            </p>
          </div>

          <form
            onSubmit={handleCreateContact}
            style={{
              borderTop: "1px solid var(--glass-border)",
              paddingTop: 16,
              display: "grid",
              gap: 10,
            }}
          >
            <div className="label">Address book</div>
            <input
              className="input"
              placeholder="Contact label"
              value={contactForm.label}
              onChange={(event) =>
                setContactForm((current) => ({
                  ...current,
                  label: event.target.value,
                }))
              }
            />
            <input
              className="input mono"
              placeholder="0x..."
              value={contactForm.walletAddress}
              onChange={(event) =>
                setContactForm((current) => ({
                  ...current,
                  walletAddress: event.target.value,
                }))
              }
            />
            <button className="btn btn-secondary" disabled={contactSaving}>
              {contactSaving ? "Saving..." : "Save contact"}
            </button>
          </form>

          <div style={{ display: "grid", gap: 8 }}>
            {contacts.length === 0 ? (
              <div className="text-muted" style={{ fontSize: 13 }}>
                No saved contacts yet.
              </div>
            ) : (
              contacts.map((contact) => (
                <div
                  key={contact.id}
                  style={{
                    display: "grid",
                    gap: 8,
                    border: "1px solid var(--glass-border)",
                    borderRadius: 12,
                    padding: 10,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <strong style={{ fontSize: 13 }}>{contact.label}</strong>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: "4px 10px", fontSize: 12 }}
                      type="button"
                      disabled={syncing}
                      onClick={() => handleDeleteContact(contact.id)}
                    >
                      Remove
                    </button>
                  </div>
                  <button
                    className="btn btn-secondary mono"
                    style={{ padding: "6px 10px", justifyContent: "flex-start", fontSize: 12 }}
                    type="button"
                    onClick={() => applyContact(contact)}
                  >
                    {contact.walletAddress}
                  </button>
                </div>
              ))
            )}
          </div>

          <div>
            <div className="label">Current draft</div>
            {intent ? (
              <div
                style={{
                  borderRadius: 18,
                  border: "1px solid rgba(16, 185, 129, 0.26)",
                  background: "rgba(16, 185, 129, 0.08)",
                  padding: 18,
                }}
              >
                <div
                  style={{
                    color: "var(--green)",
                    fontWeight: 700,
                    marginBottom: 12,
                  }}
                >
                  Payment intent ready
                </div>
                <div className="mono" style={{ fontSize: 13, marginBottom: 10 }}>
                  {intent.id}
                </div>
                <div className="text-muted" style={{ lineHeight: 1.6 }}>
                  {intent.amount} {intent.asset} on {CHAIN_LABELS[intent.chain]} to{" "}
                  {intent.recipient}
                </div>
              </div>
            ) : (
              <div className="text-muted" style={{ lineHeight: 1.6 }}>
                Prepare a payment to generate a receipt-ready draft intent.
              </div>
            )}
          </div>
        </aside>
      </div>

      <section
        style={{
          marginTop: 10,
          borderTop: "1px solid var(--glass-border)",
          paddingTop: 18,
        }}
      >
        <div className="label">Activity timeline</div>
        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          {intents.length === 0 ? (
            <div className="text-muted" style={{ fontSize: 14 }}>
              No intents yet. Create your first USDC payment draft.
            </div>
          ) : (
            intents.map((item) => (
              <article
                key={item.id}
                style={{
                  border: "1px solid var(--glass-border)",
                  borderRadius: 14,
                  padding: 12,
                  display: "grid",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                  <div className="mono" style={{ fontSize: 12 }}>
                    {item.id}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: statusColors[item.status] ?? "#fff",
                    }}
                  >
                    {item.status}
                  </div>
                </div>

                <div className="text-muted" style={{ fontSize: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <span>Created {formatTimelineTime(item.createdAt)}</span>
                  <span>Updated {formatTimelineTime(item.updatedAt)}</span>
                </div>

                <div className="text-muted" style={{ fontSize: 13 }}>
                  {item.amount} {item.asset} on {CHAIN_LABELS[item.chain]} to {item.recipient}
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {item.status === "draft" ? (
                    <button
                      className="btn btn-primary"
                      style={{ padding: "6px 12px", fontSize: 12 }}
                      type="button"
                      disabled={intentActionId === item.id}
                      onClick={() => handleSubmitIntent(item.id)}
                    >
                      {intentActionId === item.id ? "Submitting..." : "Submit"}
                    </button>
                  ) : null}

                  {item.status === "submitted" ? (
                    <button
                      className="btn btn-secondary"
                      style={{ padding: "6px 12px", fontSize: 12 }}
                      type="button"
                      disabled={intentActionId === item.id}
                      onClick={() => handleConfirmIntent(item.id)}
                    >
                      {intentActionId === item.id ? "Confirming..." : "Confirm"}
                    </button>
                  ) : null}

                  {item.txHash ? (
                    <span className="mono text-muted" style={{ fontSize: 12 }}>
                      tx: {item.txHash.slice(0, 12)}...{item.txHash.slice(-8)}
                    </span>
                  ) : null}
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section
        style={{
          marginTop: 8,
          borderTop: "1px solid var(--glass-border)",
          paddingTop: 18,
        }}
      >
        <div className="label">Settlement activity</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          {[
            { value: "all", label: "All" },
            { value: "intent_created", label: "Intents" },
            { value: "tx_submitted", label: "Transactions" },
            { value: "receipt_issued", label: "Receipts" },
            { value: "webhook_received", label: "Webhooks" },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              className="btn btn-secondary"
              style={{
                padding: "4px 10px",
                fontSize: 12,
                background:
                  activityKindFilter === option.value
                    ? "rgba(34, 211, 238, 0.16)"
                    : undefined,
              }}
              onClick={() =>
                setActivityKindFilter(
                  option.value as "all" | ActivityEventResponse["kind"],
                )
              }
            >
              {option.label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          {[
            { value: "all", label: "Any source" },
            { value: "alchemy", label: "Alchemy" },
            { value: "circle", label: "Circle" },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              className="btn btn-secondary"
              style={{
                padding: "4px 10px",
                fontSize: 12,
                background:
                  activitySourceFilter === option.value
                    ? "rgba(34, 211, 238, 0.16)"
                    : undefined,
              }}
              onClick={() =>
                setActivitySourceFilter(option.value as "all" | "alchemy" | "circle")
              }
            >
              {option.label}
            </button>
          ))}
        </div>

        <div
          style={{
            marginTop: 12,
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div className="text-muted" style={{ fontSize: 12 }}>
            Showing {activityStats.total} event{activityStats.total === 1 ? "" : "s"}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: "4px 10px", fontSize: 12 }}
              disabled={filteredActivityEvents.length === 0}
              onClick={handleExportActivityJson}
            >
              Export JSON
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: "4px 10px", fontSize: 12 }}
              disabled={filteredActivityEvents.length === 0}
              onClick={handleExportActivityCsv}
            >
              Export CSV
            </button>
            {hasActivityFilters ? (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: "4px 10px", fontSize: 12 }}
                onClick={() => {
                  setActivityKindFilter("all");
                  setActivitySourceFilter("all");
                }}
              >
                Clear filters
              </button>
            ) : null}
          </div>
        </div>

        <div
          style={{
            marginTop: 10,
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 10,
          }}
        >
          {[
            { label: "Intents", value: activityStats.kinds.intent_created ?? 0 },
            { label: "Transactions", value: activityStats.kinds.tx_submitted ?? 0 },
            { label: "Receipts", value: activityStats.kinds.receipt_issued ?? 0 },
            { label: "Webhooks", value: activityStats.kinds.webhook_received ?? 0 },
          ].map((entry) => (
            <article
              key={entry.label}
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid var(--glass-border)",
                background: "rgba(255,255,255,0.02)",
              }}
            >
              <div className="text-muted" style={{ fontSize: 12 }}>
                {entry.label}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>
                {entry.value}
              </div>
            </article>
          ))}
        </div>

        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          {filteredActivityEvents.length === 0 ? (
            <div className="text-muted" style={{ fontSize: 14 }}>
              No settlement events match your current filters.
            </div>
          ) : (
            filteredActivityEvents.map((event) => (
              <article
                key={event.id}
                style={{
                  border: "1px solid var(--glass-border)",
                  borderRadius: 14,
                  padding: 12,
                  display: "grid",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: eventColors[event.kind] ?? "#fff",
                    }}
                  >
                    {eventLabels[event.kind] ?? event.kind}
                  </span>
                  {event.webhookSource ? (
                    <span
                      className="text-muted"
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: 0.6,
                      }}
                    >
                      {normalizeWebhookSource(event.webhookSource)}
                    </span>
                  ) : null}
                  <span className="text-muted" style={{ fontSize: 12 }}>
                    {formatTimelineTime(event.occurredAt)}
                  </span>
                </div>

                <div className="text-muted" style={{ fontSize: 13 }}>
                  {event.amount} {event.asset} on {CHAIN_LABELS[event.chain]} for {event.intentId}
                </div>

                {event.webhookSource || event.webhookType ? (
                  <div className="text-muted" style={{ fontSize: 12 }}>
                    Source: {normalizeWebhookSource(event.webhookSource)}
                    {event.webhookType ? ` | ${event.webhookType}` : ""}
                  </div>
                ) : null}

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {event.txHash ? (
                    <span className="mono text-muted" style={{ fontSize: 12 }}>
                      tx: {event.txHash.slice(0, 12)}...{event.txHash.slice(-8)}
                    </span>
                  ) : null}
                  {event.receiptUrl ? (
                    <a
                      href={event.receiptUrl}
                      className="btn btn-secondary"
                      style={{ padding: "4px 10px", fontSize: 12 }}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View receipt
                    </a>
                  ) : null}
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <div style={{ marginTop: 8 }}>
        <button
          className="btn btn-secondary"
          type="button"
          disabled={syncing}
          onClick={async () => {
            setSyncing(true);
            setError(null);
            try {
              await refreshWalletState();
            } catch {
              setError("Unable to refresh production wallet state.");
            } finally {
              setSyncing(false);
            }
          }}
        >
          {syncing ? "Refreshing..." : "Refresh data"}
        </button>
      </div>
    </section>
  );
}
