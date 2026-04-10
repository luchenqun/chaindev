"use client";

import { type ReactNode } from "react";
import { EvmHomeDataProvider } from "@/domains/evm/ui/home-data-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  return <EvmHomeDataProvider>{children}</EvmHomeDataProvider>;
}
