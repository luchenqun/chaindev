import { cookies } from 'next/headers';
import { EvmHomeActivity } from '@/domains/evm/ui/home-activity';
import { EvmHomeMetrics } from '@/domains/evm/ui/home-metrics';
import { CosmosHomePage } from '@/domains/cosmos/ui/home-page';
import { AppShell } from '@/platform/layout/app-shell';
import {
  ACTIVE_PLATFORM_MODE_COOKIE_NAME,
  getDefaultActivePlatformMode,
} from '@/platform/workbench/rpc-profile';

export default async function HomePage() {
  const cookieStore = await cookies();
  const activeMode =
    cookieStore.get(ACTIVE_PLATFORM_MODE_COOKIE_NAME)?.value === 'cosmos'
      ? 'cosmos'
      : getDefaultActivePlatformMode();

  if (activeMode === 'cosmos') {
    return (
      <AppShell mode="cosmos">
        <CosmosHomePage />
      </AppShell>
    );
  }

  return (
    <AppShell mode="evm">
      <main className="pb-10">
        <section>
          <EvmHomeMetrics />
        </section>
        <EvmHomeActivity />
      </main>
    </AppShell>
  );
}
