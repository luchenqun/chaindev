import { Card } from "@/components/ui/card";
import { EvmHomeActivity } from "@/domains/evm/ui/home-activity";
import { EvmHomeMetrics } from "@/domains/evm/ui/home-metrics";
import { AppShell } from "@/platform/layout/app-shell";

export default function HomePage() {
  return (
    <AppShell>
      <main className="pb-10">
        <section>
          <Card className="overflow-hidden rounded-[18px]">
            <EvmHomeMetrics />
          </Card>
        </section>
        <EvmHomeActivity />
      </main>
    </AppShell>
  );
}
