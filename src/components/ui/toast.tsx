"use client";

import { IconAlertCircleFilled, IconCircleCheckFilled, IconInfoCircleFilled } from "@tabler/icons-react";
import { createContext, type ReactNode, useContext, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "info" | "error";

type ToastInput = {
  title: string;
  description?: ReactNode;
  tone?: ToastTone;
  durationMs?: number;
};

type ToastItem = ToastInput & {
  id: string;
  tone: ToastTone;
};

type ToastContextValue = {
  showToast: (input: ToastInput) => void;
  dismissToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function ToastCard({
  title,
  description,
  tone,
}: {
  title: string;
  description?: ReactNode;
  tone: ToastTone;
}) {
  return (
    <div
      className={cn(
        "w-full max-w-md rounded-2xl border bg-white px-4 py-3 shadow-[0_16px_40px_rgba(15,23,42,0.16)]",
        tone === "success" && "border-emerald-200",
        tone === "info" && "border-sky-200",
        tone === "error" && "border-rose-200",
      )}
    >
      <div className="flex items-start gap-3">
        {tone === "success" ? (
          <IconCircleCheckFilled className="mt-0.5 size-5 shrink-0 text-emerald-600" />
        ) : tone === "error" ? (
          <IconAlertCircleFilled className="mt-0.5 size-5 shrink-0 text-rose-600" />
        ) : (
          <IconInfoCircleFilled className="mt-0.5 size-5 shrink-0 text-sky-600" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          {description ? <div className="mt-1 text-sm text-slate-600">{description}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timeoutsRef = useRef(new Map<string, number>());

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast(input) {
        const id = crypto.randomUUID();
        const durationMs = input.durationMs ?? 3000;

        setToasts((current) => [
          ...current,
          {
            id,
            title: input.title,
            description: input.description,
            tone: input.tone ?? "success",
          },
        ]);

        const timeoutId = window.setTimeout(() => {
          setToasts((current) => current.filter((toast) => toast.id !== id));
          timeoutsRef.current.delete(id);
        }, durationMs);

        timeoutsRef.current.set(id, timeoutId);
      },
      dismissToast(id) {
        const timeoutId = timeoutsRef.current.get(id);

        if (timeoutId) {
          window.clearTimeout(timeoutId);
          timeoutsRef.current.delete(id);
        }

        setToasts((current) => current.filter((toast) => toast.id !== id));
      },
    }),
    [],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.length ? (
        <div className="pointer-events-none fixed left-1/2 top-5 z-[70] flex w-full max-w-md -translate-x-1/2 flex-col gap-3 px-4">
          {toasts.map((toast) => (
            <ToastCard
              key={toast.id}
              title={toast.title}
              description={toast.description}
              tone={toast.tone}
            />
          ))}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within a ToastProvider.");
  }

  return context;
}
