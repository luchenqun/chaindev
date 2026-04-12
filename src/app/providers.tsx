"use client";

import { type ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { EvmHomeDataProvider } from "@/domains/evm/ui/home-data-provider";
import { WorkbenchMigrationDialog } from "@/platform/auth/workbench-migration-dialog";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <EvmHomeDataProvider>
        {children}
        <WorkbenchMigrationDialog />
      </EvmHomeDataProvider>
    </SessionProvider>
  );
}
