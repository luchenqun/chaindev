'use client';

import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';

type PaginationControlsProps = {
  page: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  disabled?: boolean;
  plain?: boolean;
  onPageChange: (page: number) => void;
};

export function PaginationControls({ page, totalPages, hasPreviousPage, hasNextPage, disabled = false, plain = false, onPageChange }: PaginationControlsProps) {
  const visiblePages = getVisiblePages(page, totalPages);

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
                <PaginationEllipsis className={plain ? 'flex h-8 items-center justify-center px-1 text-slate-500' : undefined} />
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
