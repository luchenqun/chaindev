"use client";

import { type ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { EvmHomeDataProvider } from "@/domains/evm/ui/home-data-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <EvmHomeDataProvider>{children}</EvmHomeDataProvider>
    </SessionProvider>
  );
}
