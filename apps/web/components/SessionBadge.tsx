"use client";

import { useEffect, useState } from "react";
import { clearSession, loadSession, type Session } from "@/lib/session";
import { changePassword, getAuthUrl, getHomeUrl } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";

export function SessionBadge() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [showModal, setShowModal] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setSession(loadSession());
    const onStorage = () => setSession(loadSession());
    window.addEventListener("storage", onStorage);
    window.addEventListener("rcs:session", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("rcs:session", onStorage);
    };
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !newPassword) return;
    if (newPassword.length < 8) {
      toast("error", "New password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      await changePassword(oldPassword, newPassword);
      toast("success", "Password updated successfully!");
      setShowModal(false);
      setOldPassword("");
      setNewPassword("");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Password change failed");
    } finally {
      setLoading(false);
    }
  };

  if (session === undefined) {
    return <div aria-hidden="true" className="h-8 w-20 animate-pulse rounded-full bg-rise-surface-2" />;
  }

  if (session === null) {
    return (
      <a
        href={getAuthUrl("/login")}
        className="whitespace-nowrap rounded-full bg-rise-accent px-4 py-1.5 text-sm font-semibold text-rise-bg transition-transform hover:scale-105"
      >
        Dev Hub
      </a>
    );
  }

  return (
    <>
      <div className="flex items-center gap-3 text-sm">
        <span className="hidden text-rise-muted lg:inline-flex lg:items-center lg:gap-1.5">
          {session.user.name}
          <span className="rounded bg-rise-surface-2 px-1.5 py-0.5 text-xs uppercase text-rise-accent font-mono">
            {session.user.role}
          </span>
          <span className="rounded bg-rise-gold/15 border border-rise-gold/30 px-1.5 py-0.5 text-xs text-rise-gold font-mono font-semibold">
            🥇 {session.user.xp ?? 0} XP
          </span>
        </span>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="text-xs text-rise-gold hover:underline"
        >
          Password
        </button>
        <button
          type="button"
          className="text-rise-muted hover:text-rise-error"
          onClick={() => {
            clearSession();
            window.dispatchEvent(new Event("rcs:session"));
            window.location.assign(getHomeUrl());
          }}
        >
          Log out
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-rise-border bg-rise-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg text-rise-text">Change Password</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-rise-muted hover:text-rise-text"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-3 text-xs">
              <div>
                <label className="block text-rise-muted mb-1">Current Password</label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  required
                  className="w-full rounded border border-rise-border bg-rise-bg px-3 py-2 text-sm text-rise-text outline-none focus:border-rise-accent"
                />
              </div>

              <div>
                <label className="block text-rise-muted mb-1">New Password (min 8 chars)</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full rounded border border-rise-border bg-rise-bg px-3 py-2 text-sm text-rise-text outline-none focus:border-rise-accent"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded border border-rise-border px-3 py-1.5 text-rise-muted hover:text-rise-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded bg-rise-accent px-4 py-1.5 font-semibold text-rise-bg hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
