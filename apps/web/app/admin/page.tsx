"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { ClientOrder, DeveloperApplication, UserProfile } from "@rcs/shared";
import {
  API_BASE,
  ApiError,
  approveApplication,
  listApplications,
  listUsers,
  rejectApplication,
  listOrders,
  reviewOrder,
  convertOrder,
  deleteOrder,
} from "@/lib/api";
import { loadSession } from "@/lib/session";
import { useToast } from "@/components/ToastProvider";

export default function AdminPage() {
  const [applications, setApplications] = useState<readonly DeveloperApplication[]>([]);
  const [users, setUsers] = useState<readonly UserProfile[]>([]);
  const [orders, setOrders] = useState<readonly ClientOrder[]>([]);
  const [magicLinks, setMagicLinks] = useState<Record<string, string>>({});
  const [denied, setDenied] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const refresh = useCallback(async () => {
    try {
      const [apps, allUsers, allOrders] = await Promise.all([listApplications(), listUsers(), listOrders()]);
      setApplications(apps.applications);
      setUsers(allUsers.users);
      setOrders(allOrders.orders);
      setDenied(null);
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        setDenied(error.status === 403 ? "admin role required" : "login required");
        return;
      }
      toast("error", error instanceof Error ? error.message : "failed to load");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (loadSession() === null) {
      setDenied("login required");
      setLoading(false);
      return;
    }
    void refresh();
  }, [refresh]);

  async function approve(app: DeveloperApplication): Promise<void> {
    try {
      const result = await approveApplication(app.id);
      setMagicLinks((prev) => ({ ...prev, [app.id]: result.magicLinkPath }));
      toast(
        "success",
        `${app.email} approved as ${app.requestedRole}. 16-char credential generated; deliver the one-time magic link.`,
      );
      await refresh();
    } catch (error) {
      toast("error", error instanceof Error ? error.message : "approval failed");
    }
  }

  async function reject(app: DeveloperApplication): Promise<void> {
    try {
      await rejectApplication(app.id);
      toast("info", `Application from ${app.email} rejected.`);
      await refresh();
    } catch (error) {
      toast("error", error instanceof Error ? error.message : "rejection failed");
    }
  }

  async function advanceOrder(order: ClientOrder): Promise<void> {
    try {
      if (order.status === "new") {
        await reviewOrder(order.id);
        toast("success", `Request from ${order.email} is ready for project conversion.`);
      } else if (order.status === "reviewed") {
        const result = await convertOrder(order.id);
        toast("success", `Created “${result.project.name}” from the reviewed request.`);
      }
      await refresh();
    } catch (error) {
      toast("error", error instanceof Error ? error.message : "request update failed");
    }
  }

  async function removeOrder(orderId: string): Promise<void> {
    try {
      await deleteOrder(orderId);
      toast("info", `Request ${orderId.slice(0, 8)} deleted.`);
      await refresh();
    } catch (error) {
      toast("error", error instanceof Error ? error.message : "failed to delete request");
    }
  }

  if (denied !== null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-rise-muted">Admin console: {denied}.</p>
        <Link href="/login" className="text-rise-accent hover:underline">
          Log in as Admin →
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-6 sm:p-8" aria-busy="true" aria-label="Loading administration">
        <div className="h-10 w-56 animate-pulse rounded bg-rise-surface-2" />
        <div className="h-64 animate-pulse rounded-xl border border-rise-border bg-rise-surface" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 p-6 sm:p-8">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-rise-accent">Operations</p>
        <h1 className="font-display mt-2 text-4xl">Administration</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-rise-muted">
          Review verified applications, provision access, manage client requests (CRUD) and maintain a clear view of the delivery team.
        </p>
      </header>
      <div className="grid gap-3 sm:grid-cols-4">
        <AdminSummary label="Applications" value={applications.length} />
        <AdminSummary label="Awaiting decision" value={applications.filter((app) => app.status === "otp_verified").length} />
        <AdminSummary label="Client Requests" value={orders.length} />
        <AdminSummary label="Active profiles" value={users.length} />
      </div>

      {/* Client Requests Management Section (CRUD) */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-rise-border/40 pb-3">
          <div>
            <h2 className="text-xl font-semibold">Client Requests & Orders</h2>
            <p className="text-xs text-rise-muted">
              Full CRUD management: review client briefs, convert qualified requests into projects, or prune obsolete entries.
            </p>
          </div>
          <Link
            href="/request"
            className="rounded-full bg-rise-accent px-4 py-1.5 text-xs font-semibold text-rise-bg transition-transform hover:scale-105"
          >
            + Create New Client Brief
          </Link>
        </div>

        <div className="space-y-3">
          {orders.length === 0 ? (
            <p className="rounded-xl border border-rise-border bg-rise-surface p-4 text-sm text-rise-muted">
              No client requests yet.
            </p>
          ) : (
            orders.map((order) => (
              <article key={order.id} className="rounded-xl border border-rise-border bg-rise-surface p-5 space-y-3 shadow-md">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-lg text-rise-text">{order.company || order.name}</h3>
                      <span className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase font-semibold ${
                        order.status === "converted"
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          : order.status === "reviewed"
                          ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                          : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                      }`}>
                        {order.status}
                      </span>
                      <span className="rounded bg-rise-surface-2 px-2 py-0.5 font-mono text-[10px] text-rise-accent">
                        {order.projectType}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-rise-muted font-mono">
                      Client: <strong className="text-rise-text">{order.name}</strong> ({order.email})
                      {order.telegramUsername && <span className="ml-2 text-rise-gold">Telegram: {order.telegramUsername}</span>}
                    </p>
                    <p className="mt-3 max-w-3xl text-xs leading-relaxed text-rise-muted bg-rise-surface-2 p-3 rounded-lg border border-rise-border/40">
                      {order.brief}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {order.status !== "converted" && (
                      <button
                        type="button"
                        onClick={() => void advanceOrder(order)}
                        className="rounded-full bg-rise-accent/15 border border-rise-accent/40 px-3 py-1.5 text-xs font-semibold text-rise-accent hover:bg-rise-accent hover:text-rise-bg transition-colors"
                      >
                        {order.status === "new" ? "Mark Reviewed" : "Convert → Project"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void removeOrder(order.id)}
                      className="rounded-full border border-rose-500/40 px-3 py-1.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
      <section>
        <h2 className="text-xl font-semibold">Talent applications</h2>
        <p className="mb-3 text-sm text-rise-muted">
          Approve an <span className="font-mono">otp_verified</span> application
          to generate the credential and its one-time magic link.
        </p>
        <div className="overflow-x-auto rounded-xl border border-rise-border">
          {applications.length === 0 ? (
            <p className="bg-rise-surface p-4 text-sm text-rise-muted">
              No applications yet.
            </p>
          ) : (
            <table className="w-full bg-rise-surface text-left text-sm">
              <thead className="border-b border-rise-border text-xs uppercase text-rise-muted">
                <tr>
                  <th className="px-3 py-2">Applicant</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app) => (
                  <tr key={app.id} className="border-b border-rise-border last:border-0">
                    <td className="px-3 py-2">
                      <div>{app.name}</div>
                      <div className="text-xs text-rise-muted">{app.email}</div>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{app.requestedRole}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded px-2 py-0.5 font-mono text-xs ${
                          app.status === "approved"
                            ? "text-rise-success"
                            : app.status === "rejected"
                              ? "text-rise-error"
                              : "text-rise-warning"
                        }`}
                      >
                        {app.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {app.status === "otp_verified" ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void approve(app)}
                            className="rounded border border-rise-success px-2 py-1 text-xs text-rise-success hover:bg-rise-success hover:text-rise-bg"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => void reject(app)}
                            className="rounded border border-rise-error px-2 py-1 text-xs text-rise-error hover:bg-rise-error hover:text-rise-bg"
                          >
                            Reject
                          </button>
                        </div>
                      ) : magicLinks[app.id] !== undefined ? (
                        <code className="break-all text-xs text-rise-accent">
                          {API_BASE}
                          {magicLinks[app.id]}
                        </code>
                      ) : (
                        <span className="text-xs text-rise-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Team directory</h2>
        <div className="overflow-x-auto rounded-xl border border-rise-border">
          <table className="w-full bg-rise-surface text-left text-sm">
            <thead className="border-b border-rise-border text-xs uppercase text-rise-muted">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-rise-border last:border-0">
                  <td className="px-3 py-2">{user.name}</td>
                  <td className="px-3 py-2 text-rise-muted">{user.email}</td>
                  <td className="px-3 py-2 font-mono text-xs text-rise-accent">
                    {user.role}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function AdminSummary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-rise-border bg-rise-surface px-5 py-4">
      <p className="font-display text-3xl text-rise-accent">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-wide text-rise-muted">{label}</p>
    </div>
  );
}
