'use client';

import { IconKey, IconPlus } from '@tabler/icons-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { useMessages } from '@/i18n/locale-provider';
import {
  getActiveEvmStoredPrivateKey,
  listEvmStoredPrivateKeys,
  setActiveEvmStoredPrivateKey,
  subscribeEvmKeyring,
  syncEvmKeyringFromServer,
  type EvmStoredPrivateKey,
} from '@/domains/evm/client/keyring';
import { DEFAULT_EVM_PRIVATE_KEY_ID, DEFAULT_EVM_PRIVATE_KEY_NAME, DEFAULT_EVM_PRIVATE_KEY_VALUE, getDefaultAliceAddress } from '@/platform/workbench/defaults';

const ADD_KEY_ACTION_VALUE = '__chaindev_add_evm_key__';

type ActiveEvmKeySelectorProps = {
  variant?: 'default' | 'topbar-context';
  onReadyChange?: (ready: boolean) => void;
};

type ActiveEvmKeySelectorSnapshot = {
  items: EvmStoredPrivateKey[];
  activeItem: EvmStoredPrivateKey | null;
};

let cachedActiveEvmKeySelectorSnapshot: ActiveEvmKeySelectorSnapshot | null = null;

function formatAddressLabel(address: string) {
  return `${address.slice(0, 8)}...${address.slice(-4)}`;
}

function getTopbarFallbackKey(): EvmStoredPrivateKey {
  const address = getDefaultAliceAddress();

  return {
    id: DEFAULT_EVM_PRIVATE_KEY_ID,
    name: DEFAULT_EVM_PRIVATE_KEY_NAME,
    address,
    addressLower: address.toLowerCase(),
    securityMode: 'plain',
    encryptedPrivateKey: null,
    privateKey: DEFAULT_EVM_PRIVATE_KEY_VALUE,
    iv: null,
    salt: null,
    authTag: null,
    createdAt: 1,
    updatedAt: 1,
    lastUsedAt: null,
  };
}

export function ActiveEvmKeySelector({ variant = 'default', onReadyChange }: ActiveEvmKeySelectorProps) {
  const router = useRouter();
  const { status } = useSession();
  const { showToast } = useToast();
  const messages = useMessages();
  const keyMessages = messages.privateKeys;
  const isAuthenticated = status === 'authenticated';
  const [items, setItems] = useState<EvmStoredPrivateKey[]>(() => cachedActiveEvmKeySelectorSnapshot?.items ?? []);
  const [activeItem, setActiveItem] = useState<EvmStoredPrivateKey | null>(() => cachedActiveEvmKeySelectorSnapshot?.activeItem ?? null);
  const hasPersistedItems = items.length > 0;
  const topbarItems = isAuthenticated ? items : items.length ? items : [getTopbarFallbackKey()];
  const topbarActiveItem = isAuthenticated ? activeItem : (activeItem ?? topbarItems[0] ?? null);
  const showLoadingKeys = status === 'loading' && cachedActiveEvmKeySelectorSnapshot == null;

  useEffect(() => {
    onReadyChange?.(!showLoadingKeys);
  }, [onReadyChange, showLoadingKeys]);

  useEffect(() => {
    if (status === 'loading') {
      return;
    }

    let cancelled = false;

    function load() {
      if (cancelled) {
        return;
      }

      const nextItems = listEvmStoredPrivateKeys();
      const nextActiveItem = getActiveEvmStoredPrivateKey();

      cachedActiveEvmKeySelectorSnapshot = {
        items: nextItems,
        activeItem: nextActiveItem,
      };
      setItems(nextItems);
      setActiveItem(nextActiveItem);
    }

    async function bootstrap() {
      await syncEvmKeyringFromServer().catch(() => undefined);
      load();
    }

    void bootstrap();

    const unsubscribe = subscribeEvmKeyring(load);

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [status]);

  const manageHref = status === 'authenticated' ? '/settings/private-keys' : '/login?callbackUrl=%2Fsettings%2Fprivate-keys';

  function handleOpenKeySettings() {
    if (!isAuthenticated) {
      showToast({
        title: keyMessages.loginRequired,
        description: keyMessages.signInBeforeAdding,
        tone: 'info',
      });
      return;
    }

    router.push('/settings/private-keys');
  }

  if (!items.length) {
    if (variant === 'topbar-context') {
      return (
        <div className="min-w-0 shrink-0">
          <Select
            value={topbarActiveItem?.id}
            disabled={showLoadingKeys}
            onValueChange={(value) => {
              if (value === ADD_KEY_ACTION_VALUE) {
                handleOpenKeySettings();
              }
            }}
          >
            <SelectTrigger className="h-auto min-h-0 w-auto justify-start gap-0.5 rounded-none border-0 bg-transparent px-0 py-0 pr-0.5 text-[13px] font-normal leading-none shadow-none focus:ring-0">
              <div className="flex min-w-0 items-center gap-1">
                <IconKey className="size-3.5 shrink-0 text-slate-500" stroke={2} />
                <span className="truncate">
                  {showLoadingKeys ? keyMessages.loading : (topbarActiveItem?.name ?? (isAuthenticated ? keyMessages.noKey : DEFAULT_EVM_PRIVATE_KEY_NAME))}
                </span>
              </div>
            </SelectTrigger>
            <SelectContent className="min-w-[var(--radix-select-trigger-width)]">
              {topbarItems.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {`${item.name} · ${formatAddressLabel(item.address)}`}
                </SelectItem>
              ))}
              <SelectSeparator />
              <SelectItem value={ADD_KEY_ACTION_VALUE} className="rounded-none py-2.5">
                <span className="flex items-center gap-2">
                  <IconPlus className="size-4" stroke={2} />
                  <span>{keyMessages.addKey}</span>
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (showLoadingKeys) {
      return (
        <Button variant="ghost" disabled className="h-8 gap-1.5 px-2 text-[13px] font-normal text-slate-500">
          <IconKey className="size-4" stroke={2} />
          {keyMessages.loading}
        </Button>
      );
    }

    return (
      <Link href="/settings/private-keys">
        <Button variant="ghost" className="h-8 gap-1.5 px-2 text-[13px] font-normal text-slate-700">
          <IconKey className="size-4" stroke={2} />
          {keyMessages.noKey}
        </Button>
      </Link>
    );
  }

  if (variant === 'topbar-context') {
    return (
      <div className="min-w-0 shrink-0">
        <Select
          value={topbarActiveItem?.id}
          disabled={showLoadingKeys}
          onValueChange={(value) => {
            if (value === ADD_KEY_ACTION_VALUE) {
              handleOpenKeySettings();
              return;
            }

            setActiveEvmStoredPrivateKey(value);
          }}
        >
          <SelectTrigger className="h-auto min-h-0 w-auto justify-start gap-0.5 rounded-none border-0 bg-transparent px-0 py-0 pr-0.5 text-[13px] font-normal leading-none shadow-none focus:ring-0">
            <div className="flex min-w-0 items-center gap-1">
              <IconKey className="size-3.5 shrink-0 text-slate-500" stroke={2} />
              <span className="truncate">{topbarActiveItem?.name ?? DEFAULT_EVM_PRIVATE_KEY_NAME}</span>
            </div>
          </SelectTrigger>
          <SelectContent className="min-w-[var(--radix-select-trigger-width)]">
            {topbarItems.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {`${item.name} · ${formatAddressLabel(item.address)}`}
              </SelectItem>
            ))}
            <SelectSeparator />
            <SelectItem value={ADD_KEY_ACTION_VALUE} className="rounded-none py-2.5">
              <span className="flex items-center gap-2">
                <IconPlus className="size-4" stroke={2} />
                <span>{keyMessages.addKey}</span>
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0.5">
      <Select
        value={activeItem?.id}
        disabled={items.length <= 1}
        onValueChange={(value) => {
          setActiveEvmStoredPrivateKey(value);
        }}
      >
        <SelectTrigger className="h-8 w-auto justify-start gap-1 rounded-lg border-transparent bg-transparent px-2 pr-1.5 text-[13px] font-normal shadow-none hover:bg-slate-100 focus:ring-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <IconKey className="size-4 shrink-0 text-slate-500" stroke={2} />
            <span className="truncate">{activeItem?.name ?? keyMessages.selectKey}</span>
          </div>
        </SelectTrigger>
        <SelectContent className="min-w-[var(--radix-select-trigger-width)]">
          {items.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {`${item.name} · ${formatAddressLabel(item.address)}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Link
        href={manageHref}
        className="inline-flex h-6 items-center justify-center px-0.5 text-slate-500 transition hover:text-slate-900"
        aria-label={isAuthenticated ? keyMessages.manage : keyMessages.signInToManage}
      >
        <IconPlus className="size-3.5" stroke={2} />
      </Link>
    </div>
  );
}
