"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ToastKind = "info" | "success" | "error";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  /**
   * Surfaces a toast. Per PROTOTYPE.md, every automated state change must be
   * explained to the user — pass the "why" in the message.
   */
  toast(kind: ToastKind, message: string): void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (ctx === null) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}

const KIND_STYLES: Record<ToastKind, string> = {
  info: "border-rise-accent text-rise-accent",
  success: "border-rise-success text-rise-success",
  error: "border-rise-error text-rise-error",
};

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<readonly Toast[]>([]);

  const toast = useCallback((kind: ToastKind, message: string) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, kind, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-96 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded border bg-rise-surface px-4 py-3 text-sm shadow-lg ${KIND_STYLES[t.kind]}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
