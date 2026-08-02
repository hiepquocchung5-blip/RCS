"use client";

import { useCallback, useEffect, useState } from "react";
import type { StockShare, StockTransaction } from "@rcs/shared";
import { isStockFounder } from "@rcs/shared";
import { getStockData, addShares, addStockTransaction, ApiError } from "@/lib/api";
import { loadSession } from "@/lib/session";
import { useToast } from "@/components/ToastProvider";

const FOUNDER_NAMES: Record<string, string> = {
  "filip@risecorestudio.com": "Filip",
  "shayy@risecorestudio.com": "Shayy",
  "paihtookhant@risecorestudio.com": "Pai Htoo Khant",
};

const FOUNDER_COLORS: Record<string, string> = {
  "filip@risecorestudio.com": "#00f0ff", // rise-accent (cyan)
  "shayy@risecorestudio.com": "#d4b06a", // rise-gold
  "paihtookhant@risecorestudio.com": "#39ff14", // rise-success (green)
};

export default function StockPage() {
  const [shares, setShares] = useState<StockShare[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [denied, setDenied] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Form states
  const [targetFounder, setTargetFounder] = useState("filip@risecorestudio.com");
  const [sharesAmount, setSharesAmount] = useState("1");
  const [txType, setTxType] = useState<"income" | "outcome" | "expense">("income");
  const [txAmount, setTxAmount] = useState("");
  const [txDescription, setTxDescription] = useState("");
  const [busyShares, setBusyShares] = useState(false);
  const [busyTx, setBusyTx] = useState(false);

  const { toast } = useToast();

  const refresh = useCallback(async () => {
    try {
      const data = await getStockData();
      setShares(data.shares);
      setTransactions(data.transactions);
      setDenied(null);
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        setDenied(error.status === 403 ? "founder role required" : "login required");
        return;
      }
      toast("error", error instanceof Error ? error.message : "failed to load stock data");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const session = loadSession();
    if (session === null) {
      setDenied("login required");
      setLoading(false);
      return;
    }
    if (!isStockFounder(session.user.email)) {
      setDenied("founder role required");
      setLoading(false);
      return;
    }
    refresh();
  }, [refresh]);

  async function handleAddShares(e: React.FormEvent) {
    e.preventDefault();
    const count = Number(sharesAmount);
    if (isNaN(count) || count <= 0) {
      toast("error", "Please enter a valid shares count");
      return;
    }

    setBusyShares(true);
    try {
      await addShares({
        founderEmail: targetFounder,
        sharesCount: count,
        pricePerShare: 32000,
      });
      toast("success", `Successfully added ${count} shares.`);
      setSharesAmount("1");
      await refresh();
    } catch (error) {
      toast("error", error instanceof Error ? error.message : "failed to add shares");
    } finally {
      setBusyShares(false);
    }
  }

  async function handleAddTransaction(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(txAmount);
    if (isNaN(amount) || amount <= 0) {
      toast("error", "Please enter a valid transaction amount");
      return;
    }
    if (txDescription.trim().length === 0) {
      toast("error", "Please enter a description");
      return;
    }

    setBusyTx(true);
    try {
      await addStockTransaction({
        type: txType,
        amount,
        description: txDescription.trim(),
      });
      toast("success", `Transaction recorded successfully.`);
      setTxAmount("");
      setTxDescription("");
      await refresh();
    } catch (error) {
      toast("error", error instanceof Error ? error.message : "failed to record transaction");
    } finally {
      setBusyTx(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="animate-pulse text-sm text-rise-muted">Loading stock matrix…</span>
      </div>
    );
  }

  if (denied !== null) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <div className="max-w-md rounded-xl border border-rise-border bg-rise-surface p-8 shadow-xl">
          <p className="text-4xl">🔒</p>
          <h1 className="mt-4 text-xl font-bold text-rise-text">Access Denied</h1>
          <p className="mt-2 text-sm text-rise-muted">
            {denied === "login required"
              ? "You must sign in to access the Stock Management Portal."
              : "This area is restricted to founders of RiseCoreStudio only."}
          </p>
          {denied === "login required" && (
            <a
              href="/login"
              className="mt-6 inline-block rounded-full bg-rise-accent px-6 py-2 text-sm font-semibold text-rise-bg transition-transform hover:scale-105"
            >
              Sign in
            </a>
          )}
        </div>
      </div>
    );
  }

  // calculations
  const totalShares = shares.reduce((sum, item) => sum + item.sharesCount, 0);
  const sharePrice = 32000;
  const totalValue = totalShares * sharePrice;

  const totalIncome = transactions
    .filter((tx) => tx.type === "income")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const totalExpense = transactions
    .filter((tx) => tx.type === "expense" || tx.type === "outcome")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const netBalance = totalIncome - totalExpense;

  // Chart configuration: SVG stroke math
  // R = 50, C = 2 * PI * R = 314.159
  const R = 50;
  const C = 2 * Math.PI * R;
  let cumPercent = 0;

  const chartSegments = shares.map((item) => {
    const sharePercent = totalShares > 0 ? item.sharesCount / totalShares : 0;
    const strokeDash = sharePercent * C;
    const strokeOffset = C - strokeDash;
    const rotation = cumPercent * 360 - 90; // Start at 12 o'clock (-90deg)
    cumPercent += sharePercent;

    return {
      email: item.founderEmail,
      percent: sharePercent * 100,
      strokeDash,
      strokeOffset,
      rotation,
      color: FOUNDER_COLORS[item.founderEmail.toLowerCase()] || "#8b91a7",
      name: FOUNDER_NAMES[item.founderEmail.toLowerCase()] || item.founderEmail,
      count: item.sharesCount,
      val: item.sharesCount * sharePrice,
    };
  });

  return (
    <div className="relative min-h-full p-6 sm:p-10">
      {/* Background Orbs */}
      <div
        className="orb float-slow left-[-5%] top-[-5%] h-80 w-80"
        style={{ background: "color-mix(in srgb, var(--color-rise-accent) 10%, transparent)" }}
      />
      <div
        className="orb glow-pulse right-[-5%] bottom-[-5%] h-96 w-96"
        style={{ background: "color-mix(in srgb, var(--color-rise-gold) 8%, transparent)" }}
      />

      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-2">
            <p className="font-mono text-xs uppercase tracking-[0.4em] text-rise-gold">
              RCS/Stock Portal
            </p>
            <h1 className="font-display text-4xl sm:text-5xl text-rise-text">Stock & Shareholder Ledger</h1>
            <p className="text-sm text-rise-muted max-w-2xl leading-relaxed">
              Private ledger for founding shareholders. Track capitalization, share distributions,
              capital calls, and corporate cash flow details securely.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              let csvContent = "data:text/csv;charset=utf-8,Founder,Email,Shares,Percentage,Value (MMK)\n";
              shares.forEach((item) => {
                const name = FOUNDER_NAMES[item.founderEmail.toLowerCase()] || item.founderEmail;
                const percent = totalShares > 0 ? ((item.sharesCount / totalShares) * 100).toFixed(2) : "0";
                const val = item.sharesCount * 32000;
                csvContent += `"${name}","${item.founderEmail}",${item.sharesCount},${percent}%,${val}\n`;
              });
              const encodedUri = encodeURI(csvContent);
              const link = document.createElement("a");
              link.setAttribute("href", encodedUri);
              link.setAttribute("download", `RCS_Cap_Table_${new Date().toISOString().slice(0, 10)}.csv`);
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              toast("success", "Cap Table exported to CSV!");
            }}
            className="rounded-full border border-rise-gold/40 bg-rise-gold/10 px-4 py-2 text-xs font-semibold text-rise-gold hover:bg-rise-gold hover:text-rise-bg transition-colors shadow-lg"
          >
            📊 Export Cap Table (CSV)
          </button>
        </header>

        {/* 1. Dashboard Grid */}
        <section className="grid gap-6 md:grid-cols-3 mb-10">
          <div className="rounded-2xl border border-rise-border bg-rise-surface/40 p-6 backdrop-blur-md">
            <h2 className="text-xs font-mono uppercase tracking-wider text-rise-muted">Capitalization</h2>
            <p className="mt-4 text-3xl font-bold text-rise-text">{totalShares} Shares</p>
            <p className="mt-1 text-xs text-rise-muted">
              Valued at <span className="font-semibold text-rise-gold">{totalValue.toLocaleString()} MMK</span> (32,000 / Share)
            </p>
          </div>

          <div className="rounded-2xl border border-rise-border bg-rise-surface/40 p-6 backdrop-blur-md">
            <h2 className="text-xs font-mono uppercase tracking-wider text-rise-muted">Corporate Income</h2>
            <p className="mt-4 text-3xl font-bold text-rise-success">+{totalIncome.toLocaleString()} MMK</p>
            <p className="mt-1 text-xs text-rise-muted">Gross recorded inputs</p>
          </div>

          <div className="rounded-2xl border border-rise-border bg-rise-surface/40 p-6 backdrop-blur-md">
            <h2 className="text-xs font-mono uppercase tracking-wider text-rise-muted">Outcomes / Expenses</h2>
            <p className="mt-4 text-3xl font-bold text-rise-error">-{totalExpense.toLocaleString()} MMK</p>
            <p className="mt-1 text-xs text-rise-muted">
              Net balance:{" "}
              <span className={`font-semibold ${netBalance >= 0 ? "text-rise-success" : "text-rise-error"}`}>
                {netBalance >= 0 ? "+" : ""}
                {netBalance.toLocaleString()} MMK
              </span>
            </p>
          </div>
        </section>

        {/* 2. Visualizations and Operations */}
        <section className="grid gap-6 lg:grid-cols-[1.2fr_1.8fr] mb-10">
          {/* Share Donut Chart */}
          <div className="rounded-2xl border border-rise-border bg-rise-surface/40 p-6 backdrop-blur-md flex flex-col justify-between">
            <div>
              <h2 className="text-sm font-semibold text-rise-text mb-4">Capital Distribution</h2>
              <div className="relative my-6 flex justify-center">
                <svg width="200" height="200" className="rotate-0 transition-transform">
                  <circle cx="100" cy="100" r={R} fill="transparent" stroke="var(--color-rise-border)" strokeWidth="18" />
                  {chartSegments.map((seg, idx) => (
                    <circle
                      key={idx}
                      cx="100"
                      cy="100"
                      r={R}
                      fill="transparent"
                      stroke={seg.color}
                      strokeWidth="18"
                      strokeDasharray={`${seg.strokeDash} ${C}`}
                      strokeDashoffset={C}
                      style={{
                        transform: `rotate(${seg.rotation}deg)`,
                        transformOrigin: "center",
                        transition: "all 0.5s ease",
                      }}
                    />
                  ))}
                </svg>
                {/* Center text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-rise-text">{totalShares}</span>
                  <span className="text-[10px] uppercase tracking-wider text-rise-muted">Total Shares</span>
                </div>
              </div>
            </div>

            {/* Legend list */}
            <div className="flex flex-col gap-3 mt-4 border-t border-rise-border/60 pt-4">
              {chartSegments.map((seg, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: seg.color }} />
                    <span className="font-semibold text-rise-text">{seg.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-rise-text">{seg.count} Shares</span>{" "}
                    <span className="text-rise-muted">({seg.percent.toFixed(1)}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Shareholder Operations Forms */}
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Add Shares Form */}
            <div className="rounded-2xl border border-rise-border bg-rise-surface/40 p-6 backdrop-blur-md">
              <h2 className="text-sm font-semibold text-rise-text mb-4">Issue New Shares</h2>
              <form onSubmit={handleAddShares} className="flex flex-col gap-4">
                <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wider text-rise-muted">
                  Shareholder
                  <select
                    value={targetFounder}
                    onChange={(e) => setTargetFounder(e.target.value)}
                    className="mt-1 rounded-lg border border-rise-border bg-rise-bg/40 px-3 py-2 text-xs text-rise-text outline-none focus:border-rise-accent"
                  >
                    {Object.entries(FOUNDER_NAMES).map(([email, name]) => (
                      <option key={email} value={email} className="bg-rise-surface">
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wider text-rise-muted">
                  Shares Count
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={sharesAmount}
                    onChange={(e) => setSharesAmount(e.target.value)}
                    className="mt-1 rounded-lg border border-rise-border bg-rise-bg/40 px-3 py-2 text-xs text-rise-text outline-none focus:border-rise-accent"
                  />
                </label>
                <button
                  type="submit"
                  disabled={busyShares}
                  className="mt-2 rounded-lg bg-rise-accent py-2 text-xs font-bold text-rise-bg transition-opacity disabled:opacity-50"
                >
                  {busyShares ? "Issuing…" : "Issue Shares"}
                </button>
              </form>
            </div>

            {/* Record Transaction Form */}
            <div className="rounded-2xl border border-rise-border bg-rise-surface/40 p-6 backdrop-blur-md">
              <h2 className="text-sm font-semibold text-rise-text mb-4">Record Transaction</h2>
              <form onSubmit={handleAddTransaction} className="flex flex-col gap-4">
                <div className="grid grid-cols-3 gap-1 bg-rise-bg/40 p-0.5 rounded-lg border border-rise-border">
                  {(["income", "outcome", "expense"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setTxType(type)}
                      className={`rounded px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                        txType === type
                          ? "bg-rise-surface-2 text-rise-accent"
                          : "text-rise-muted hover:text-rise-text"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wider text-rise-muted">
                  Amount (MMK)
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="e.g. 500000"
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    className="mt-1 rounded-lg border border-rise-border bg-rise-bg/40 px-3 py-2 text-xs text-rise-text outline-none focus:border-rise-accent"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wider text-rise-muted">
                  Description
                  <input
                    type="text"
                    required
                    placeholder="e.g. Server hosting renewal"
                    value={txDescription}
                    onChange={(e) => setTxDescription(e.target.value)}
                    className="mt-1 rounded-lg border border-rise-border bg-rise-bg/40 px-3 py-2 text-xs text-rise-text outline-none focus:border-rise-accent"
                  />
                </label>
                <button
                  type="submit"
                  disabled={busyTx}
                  className="mt-2 rounded-lg bg-rise-accent py-2 text-xs font-bold text-rise-bg transition-opacity disabled:opacity-50"
                >
                  {busyTx ? "Recording…" : "Record Ledger"}
                </button>
              </form>
            </div>
          </div>
        </section>

        {/* 3. Transaction History */}
        <section className="rounded-2xl border border-rise-border bg-rise-surface/40 p-6 backdrop-blur-md">
          <h2 className="text-sm font-semibold text-rise-text mb-4">Financial Log</h2>
          {transactions.length === 0 ? (
            <p className="text-xs text-rise-muted py-6 text-center">No transactions recorded in ledger.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-rise-border/60 text-rise-muted">
                    <th className="py-2.5 font-semibold">Date</th>
                    <th className="py-2.5 font-semibold">Description</th>
                    <th className="py-2.5 font-semibold">Recorder</th>
                    <th className="py-2.5 font-semibold">Type</th>
                    <th className="py-2.5 font-semibold text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rise-border/40">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="text-rise-text">
                      <td className="py-3 text-rise-muted font-mono">
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 font-medium">{tx.description}</td>
                      <td className="py-3 text-rise-muted">
                        {FOUNDER_NAMES[tx.createdBy.toLowerCase()] || tx.createdBy}
                      </td>
                      <td className="py-3">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                            tx.type === "income"
                              ? "bg-rise-success/10 text-rise-success"
                              : tx.type === "outcome"
                              ? "bg-rise-warning/10 text-rise-warning"
                              : "bg-rise-error/10 text-rise-error"
                          }`}
                        >
                          {tx.type}
                        </span>
                      </td>
                      <td
                        className={`py-3 text-right font-semibold font-mono ${
                          tx.type === "income" ? "text-rise-success" : "text-rise-error"
                        }`}
                      >
                        {tx.type === "income" ? "+" : "-"}
                        {tx.amount.toLocaleString()} MMK
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
