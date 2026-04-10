import { ReactNode } from "react";
import { TopNav } from "@/platform/layout/top-nav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <TopNav />
      <div className="page-frame">{children}</div>
    </div>
  );
}
