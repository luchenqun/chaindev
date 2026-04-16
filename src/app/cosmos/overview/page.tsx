import { AppShell } from '@/platform/layout/app-shell';
import { CosmosHomePage } from '@/domains/cosmos/ui/home-page';

export default function CosmosOverviewPage() {
  return (
    <AppShell mode="cosmos">
      <CosmosHomePage />
    </AppShell>
  );
}
