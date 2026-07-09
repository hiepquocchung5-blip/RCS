"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { DeveloperApplication, UserProfile } from "@rcs/shared";
import {
  API_BASE,
  ApiError,
  approveApplication,
  listApplications,
  listUsers,
  rejectApplication,
} from "@/lib/api";
import { loadSession } from "@/lib/session";
import { useToast } from "@/components/ToastProvider";

export default function AdminPage() {
  const [applications, setApplications] = useState<readonly DeveloperApplication[]>([]);
  const [users, setUsers] = useState<readonly UserProfile[]>([]);
  const [magicLinks, setMagicLinks] = useState<Record<string, string>>({});
  const [denied, setDenied] = useState<string | null>(null);
  const { toast } = useToast();

  const refresh = useCallback(async () => {
    try {
      const [apps, allUsers] = await Promise.all([listApplications(), listUsers()]);
      setApplications(apps.applications);
      setUsers(allUsers.users);
      setDenied(null);
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        setDenied(error.status === 403 ? "admin role required" : "login required");
        return;
      }
      toast("error", error instanceof Error ? error.message : "failed to load");
    }
  }, [toast]);

  useEffect(() => {
    if (loadSession() === null) {
      setDenied("login required");
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

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 p-6">
      <section>
        <h1 className="text-xl font-bold">Applications</h1>
        <p className="mb-3 text-sm text-rise-muted">
          Approve an <span className="font-mono">otp_verified</span> application
          to generate the credential and its one-time magic link.
        </p>
        <div className="overflow-hidden rounded-lg border border-rise-border">
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
        <h2 className="mb-3 text-xl font-bold">Users</h2>
        <div className="overflow-hidden rounded-lg border border-rise-border">
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
