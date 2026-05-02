'use client';

import { useState } from 'react';
import { IconArrowUp, IconBrandGithub, IconExternalLink, IconHeartFilled } from '@tabler/icons-react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ModalDialog } from '@/components/ui/modal-dialog';

type FooterLinkItem = {
  href: string;
  label: string;
  external?: boolean;
};

type FooterSection = {
  title: string;
  items: FooterLinkItem[];
};

const FOOTER_SECTIONS: FooterSection[] = [
  {
    title: 'Explore',
    items: [
      { href: '/evm/blocks', label: 'EVM Blocks' },
      { href: '/evm/txs', label: 'EVM Transactions' },
      { href: '/cosmos/blocks', label: 'Cosmos Blocks' },
      { href: '/cosmos/txs', label: 'Cosmos Transactions' },
    ],
  },
  {
    title: 'Tools',
    items: [
      { href: '/evm/tools/rpc', label: 'RPC API' },
      { href: '/cosmos/tools/rest', label: 'REST API' },
      { href: '/tools/4byte', label: 'Signature Lookup' },
      { href: '/tools/wallet-generator', label: 'Wallet Generator' },
    ],
  },
  {
    title: 'Workbench',
    items: [
      { href: '/tools/bech32', label: 'Bech32' },
      { href: '/tools/keystore', label: 'Keystore' },
      { href: '/settings/providers', label: 'Providers' },
      { href: 'https://github.com/luchenqun/chaindev', label: 'GitHub', external: true },
    ],
  },
];

const DONATION_ADDRESS = '0xFA60Cc962cacc89656B529EB97c2762D8df89E70';

function FooterLink({ item }: { item: FooterLinkItem }) {
  if (item.external) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-sm text-slate-600 transition hover:text-slate-950"
      >
        <span>{item.label}</span>
        <IconExternalLink className="size-3.5 shrink-0" stroke={1.9} />
      </a>
    );
  }

  return (
    <Link href={item.href} prefetch={false} className="text-sm text-slate-600 transition hover:text-slate-950">
      {item.label}
    </Link>
  );
}

export function SiteFooter() {
  const [donationQrOpen, setDonationQrOpen] = useState(false);

  return (
    <footer className="mt-12 border-t border-slate-200 bg-[#f8f9fa]">
      <div className="mx-auto max-w-[1400px] px-3 py-5">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <a
            href="https://github.com/luchenqun/chaindev"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 transition hover:text-slate-950"
          >
            <IconBrandGithub className="size-4" stroke={1.9} />
            <span>GitHub</span>
          </a>
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 transition hover:text-slate-950"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <IconArrowUp className="size-4" stroke={1.9} />
            <span>Back to Top</span>
          </button>
        </div>

        <div className="grid gap-10 py-9 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)]">
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <Image alt="Chain Dev for EVM & Cosmos" className="h-11 w-11" height={44} src="/brand-mark.svg" width={44} />
              <div>
                <div className="text-[16px] font-semibold text-slate-950">Chain Dev for EVM &amp; Cosmos</div>
                <p className="mt-1 max-w-md text-sm leading-6 text-slate-600">Unified explorer and browser-based workbench for EVM and Cosmos chains.</p>
              </div>
            </div>

          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            {FOOTER_SECTIONS.map((section) => (
              <div key={section.title}>
                <div className="text-sm font-semibold text-slate-950">{section.title}</div>
                <div className="mt-4 space-y-3">
                  {section.items.map((item) => (
                    <div key={item.href}>
                      <FooterLink item={item} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span>Chain Dev © 2026</span>
            <span>|</span>
            <span>Built by Luke</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-slate-800">
            <span>Donations:</span>
            <button
              type="button"
              className="cursor-pointer font-medium text-[#6f49f6] transition hover:text-[#5b38dd]"
              onClick={() => setDonationQrOpen(true)}
            >
              {DONATION_ADDRESS}
            </button>
            <IconHeartFilled className="size-4 text-rose-500" />
          </div>
        </div>
      </div>

      <ModalDialog
        open={donationQrOpen}
        onOpenChange={setDonationQrOpen}
        title="Donation Address"
        description="Scan this address with your wallet, or copy it directly from the footer."
        maxWidthClassName="max-w-md"
        footer={
          <Button variant="outline" onClick={() => setDonationQrOpen(false)}>
            Close
          </Button>
        }
      >
        <div className="flex flex-col items-center gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <Image
              alt="Donation QR code"
              className="h-64 w-64"
              height={256}
              src={`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(DONATION_ADDRESS)}`}
              unoptimized
              width={256}
            />
          </div>
          <div className="break-all text-center font-mono text-sm text-slate-700">{DONATION_ADDRESS}</div>
        </div>
      </ModalDialog>
    </footer>
  );
}
