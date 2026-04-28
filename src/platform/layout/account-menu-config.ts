import type { PlatformMode } from '@/config/chains';

export type AccountMenuItem = {
  href: string;
  label: string;
  modes?: PlatformMode[];
};

export type AccountMenuSection = {
  id: string;
  label: string;
  items: AccountMenuItem[];
};

export const accountMenuSections: AccountMenuSection[] = [
  {
    id: 'account',
    label: 'Account',
    items: [
      { href: '/evm/settings/providers', label: 'Providers', modes: ['evm'] },
      {
        href: '/cosmos/settings/providers',
        label: 'Providers',
        modes: ['cosmos'],
      },
      {
        href: '/evm/settings/private-keys',
        label: 'Private Keys',
        modes: ['evm', 'cosmos'],
      },
      { href: '/evm/settings/name-tags', label: 'Name Tags', modes: ['evm'] },
    ],
  },
  {
    id: 'workspace',
    label: 'Workspace',
    items: [{ href: '/evm/contracts', label: 'Contracts', modes: ['evm'] }],
  },
];

export function getAccountMenuSections(mode: PlatformMode) {
  return accountMenuSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.modes || item.modes.includes(mode)),
    }))
    .filter((section) => section.items.length > 0);
}
