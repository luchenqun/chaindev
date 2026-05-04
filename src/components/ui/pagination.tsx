'use client';

import * as React from 'react';
import { IconChevronLeft, IconChevronRight, IconDots } from '@tabler/icons-react';
import { buttonVariants } from '@/components/ui/button';
import { useMessages } from '@/i18n/locale-provider';
import { cn } from '@/lib/utils';

function Pagination({ className, ...props }: React.ComponentProps<'nav'>) {
  const messages = useMessages();

  return <nav role="navigation" aria-label={messages.common.pagination} className={cn('mx-auto flex w-full justify-center', className)} {...props} />;
}

function PaginationContent({ className, ...props }: React.ComponentProps<'ul'>) {
  return <ul className={cn('flex flex-row items-center gap-1', className)} {...props} />;
}

function PaginationItem({ ...props }: React.ComponentProps<'li'>) {
  return <li {...props} />;
}

type PaginationLinkProps = {
  isActive?: boolean;
} & React.ComponentProps<'button'>;

function PaginationLink({ className, isActive, ...props }: PaginationLinkProps) {
  return (
    <button
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        buttonVariants({
          variant: 'ghost',
          size: 'icon',
        }),
        isActive
          ? 'size-8 rounded-md border border-slate-300 bg-white text-sm text-slate-900 shadow-sm hover:bg-white'
          : 'size-8 rounded-md text-sm text-slate-900 hover:bg-slate-50',
        className,
      )}
      {...props}
    />
  );
}

function PaginationPrevious({ className, ...props }: React.ComponentProps<typeof PaginationLink>) {
  const messages = useMessages();

  return (
    <PaginationLink aria-label={messages.common.previous} className={cn('h-8 w-auto gap-1 px-2.5 text-sm', className)} {...props}>
      <IconChevronLeft className="size-4" stroke={2} />
      <span>{messages.common.previous}</span>
    </PaginationLink>
  );
}

function PaginationNext({ className, ...props }: React.ComponentProps<typeof PaginationLink>) {
  const messages = useMessages();

  return (
    <PaginationLink aria-label={messages.common.next} className={cn('h-8 w-auto gap-1 px-2.5 text-sm', className)} {...props}>
      <span>{messages.common.next}</span>
      <IconChevronRight className="size-4" stroke={2} />
    </PaginationLink>
  );
}

function PaginationEllipsis({ className, ...props }: React.ComponentProps<'button'>) {
  const messages = useMessages();

  return (
    <button
      type="button"
      aria-label={messages.common.jumpToPage}
      className={cn('flex size-8 items-center justify-center rounded-md text-slate-900 hover:bg-slate-50 hover:text-sky-600 disabled:pointer-events-none disabled:opacity-50', className)}
      {...props}
    >
      <IconDots className="size-4" stroke={2} />
    </button>
  );
}

export { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious };
