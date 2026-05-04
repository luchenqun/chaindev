import type { PlatformMode } from '@/config/chains';
import type { Messages } from '@/i18n';

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

export function getAccountMenuSections(mode: PlatformMode, messages: Messages) {
  const accountMenuSections: AccountMenuSection[] = [
    {
      id: 'account',
      label: messages.topNav.account,
      items: [
        { href: '/settings/providers', label: messages.navigation.providers, modes: ['evm', 'cosmos'] },
        {
          href: '/settings/private-keys',
          label: messages.navigation.privateKeys,
          modes: ['evm', 'cosmos'],
        },
        { href: '/evm/settings/name-tags', label: messages.navigation.nameTags, modes: ['evm'] },
      ],
    },
    {
      id: 'workspace',
      label: messages.topNav.workspace,
      items: [{ href: '/evm/contracts', label: messages.navigation.contracts, modes: ['evm'] }],
    },
  ];

  return accountMenuSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.modes || item.modes.includes(mode)),
    }))
    .filter((section) => section.items.length > 0);
}
