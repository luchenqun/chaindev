import { EvmHomeActivity } from "@/domains/evm/ui/home-activity";
import { EvmHomeMetrics } from "@/domains/evm/ui/home-metrics";
import { AppShell } from "@/platform/layout/app-shell";

export default function HomePage() {
  return (
    <AppShell>
      <main className="pb-10">
        <section>
          <EvmHomeMetrics />
        </section>
        <EvmHomeActivity />
      </main>
    </AppShell>
  );
}
