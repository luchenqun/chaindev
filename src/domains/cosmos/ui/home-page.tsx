'use client';

import { CosmosHomeActivity } from '@/domains/cosmos/ui/home-activity';
import { CosmosHomeMetrics } from '@/domains/cosmos/ui/home-metrics';

export function CosmosHomePage() {
  return (
    <main className="pb-10">
      <section>
        <CosmosHomeMetrics />
      </section>
      <CosmosHomeActivity />
    </main>
  );
}
