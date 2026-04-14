"use client";

import { type ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { ToastProvider } from "@/components/ui/toast";
import { EvmHomeDataProvider } from "@/domains/evm/ui/home-data-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>
        <EvmHomeDataProvider>{children}</EvmHomeDataProvider>
      </ToastProvider>
    </SessionProvider>
  );
}
