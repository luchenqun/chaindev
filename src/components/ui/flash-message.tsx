"use client";

import { IconCircleCheckFilled, IconInfoCircleFilled } from "@tabler/icons-react";
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

type FlashMessageProps = {
  title: string;
  description?: ReactNode;
  tone?: "success" | "info";
};

export function FlashMessage({
  title,
  description,
  tone = "success",
}: FlashMessageProps) {
  return (
    <div
      className={cn(
        "fixed left-1/2 top-5 z-[60] w-full max-w-md -translate-x-1/2 rounded-2xl border bg-white px-4 py-3 shadow-[0_16px_40px_rgba(15,23,42,0.16)]",
        tone === "success" ? "border-emerald-200" : "border-sky-200",
      )}
    >
      <div className="flex items-start gap-3">
        {tone === "success" ? (
          <IconCircleCheckFilled className="mt-0.5 size-5 shrink-0 text-emerald-600" />
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
