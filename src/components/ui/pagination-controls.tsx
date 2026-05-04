'use client';

import { useEffect, useId, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { useLocale, useMessages } from '@/i18n/locale-provider';

type PaginationControlsProps = {
  page: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  disabled?: boolean;
  plain?: boolean;
  onPageChange: (page: number) => void;
};

export function PaginationControls({
  page,
  totalPages,
  hasPreviousPage,
  hasNextPage,
  disabled = false,
  plain = false,
  onPageChange,
}: PaginationControlsProps) {
  const messages = useMessages();
  const { locale } = useLocale();
  const visiblePages = getVisiblePages(page, totalPages);
  const formId = useId();
  const inputId = useId();
  const [jumpDialogOpen, setJumpDialogOpen] = useState(false);
  const [jumpPageText, setJumpPageText] = useState(String(page));
  const parsedJumpPage = Number.parseInt(jumpPageText, 10);
  const normalizedJumpPage = Number.isFinite(parsedJumpPage) ? Math.min(Math.max(parsedJumpPage, 1), totalPages) : page;

  useEffect(() => {
    if (jumpDialogOpen) {
      setJumpPageText('');
    }
  }, [jumpDialogOpen]);

  function handleJumpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!Number.isFinite(parsedJumpPage)) {
      return;
    }

    onPageChange(normalizedJumpPage);
    setJumpDialogOpen(false);
  }

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-end">
      <Pagination className="mx-0 w-auto justify-start lg:justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              type="button"
              className={plain ? 'inline-flex h-8 items-center justify-center gap-1 px-0 leading-none align-middle text-slate-900 hover:bg-transparent hover:text-sky-600' : undefined}
              disabled={!hasPreviousPage || disabled}
              onClick={() => onPageChange(page - 1)}
            />
          </PaginationItem>
          {visiblePages.map((item, index) =>
            item === 'ellipsis' ? (
              <PaginationItem key={`ellipsis-${index}`}>
                <PaginationEllipsis
                  disabled={disabled}
                  className={plain ? 'flex h-8 items-center justify-center px-1 text-slate-500 hover:text-sky-600' : undefined}
                  onClick={() => setJumpDialogOpen(true)}
                />
              </PaginationItem>
            ) : (
              <PaginationItem key={item}>
                <PaginationLink
                  type="button"
                  isActive={item === page}
                  className={
                    plain
                      ? item === page
                        ? 'inline-flex h-8 w-auto min-w-0 items-center justify-center rounded-none border-0 bg-transparent px-1 leading-none text-sky-600 shadow-none hover:bg-transparent hover:text-sky-600'
                        : 'inline-flex h-8 w-auto min-w-0 items-center justify-center rounded-none border-0 bg-transparent px-1 leading-none text-slate-500 hover:bg-transparent hover:text-sky-600'
                      : undefined
                  }
                  disabled={disabled}
                  onClick={() => onPageChange(item)}
                >
                  {item}
                </PaginationLink>
              </PaginationItem>
            ),
          )}
          <PaginationItem>
            <PaginationNext
              type="button"
              className={plain ? 'inline-flex h-8 items-center justify-center gap-1 px-0 leading-none align-middle text-slate-900 hover:bg-transparent hover:text-sky-600' : undefined}
              disabled={!hasNextPage || disabled}
              onClick={() => onPageChange(page + 1)}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
      <ModalDialog
        open={jumpDialogOpen}
        onOpenChange={setJumpDialogOpen}
        title={messages.common.jumpToPage}
        description={`${messages.common.page} 1 - ${totalPages.toLocaleString(locale)}`}
        maxWidthClassName="max-w-sm"
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setJumpDialogOpen(false)}>
              {messages.common.cancel}
            </Button>
            <Button type="submit" form={formId} disabled={!Number.isFinite(parsedJumpPage)}>
              {messages.common.go}
            </Button>
          </>
        }
      >
        <form id={formId} className="space-y-2" onSubmit={handleJumpSubmit}>
          <label className="block text-sm font-medium text-slate-700" htmlFor={inputId}>
            {messages.common.page}
          </label>
          <Input
            id={inputId}
            type="number"
            min={1}
            max={totalPages}
            value={jumpPageText}
            autoFocus
            onChange={(event) => setJumpPageText(event.target.value)}
          />
          <p className="text-xs text-slate-500">
            {Number.isFinite(parsedJumpPage)
              ? messages.common.willOpenPage.replace('{page}', normalizedJumpPage.toLocaleString(locale))
              : messages.common.currentPageIs.replace('{page}', page.toLocaleString(locale))}
          </p>
        </form>
      </ModalDialog>
    </div>
  );
}

function getVisiblePages(page: number, totalPages: number) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (page <= 3) {
    return [1, 2, 3, 'ellipsis', totalPages] as const;
  }

  if (page >= totalPages - 2) {
    return [1, 'ellipsis', totalPages - 2, totalPages - 1, totalPages] as const;
  }

  return [1, 'ellipsis', page - 1, page, page + 1, 'ellipsis', totalPages] as const;
}
