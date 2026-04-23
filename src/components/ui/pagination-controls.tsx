'use client';

import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';

type PaginationControlsProps = {
  page: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  disabled?: boolean;
  onPageChange: (page: number) => void;
};

export function PaginationControls({ page, totalPages, hasPreviousPage, hasNextPage, disabled = false, onPageChange }: PaginationControlsProps) {
  const visiblePages = getVisiblePages(page, totalPages);

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-end">
      <Pagination className="mx-0 w-auto justify-start lg:justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious type="button" disabled={!hasPreviousPage || disabled} onClick={() => onPageChange(page - 1)} />
          </PaginationItem>
          {visiblePages.map((item, index) =>
            item === 'ellipsis' ? (
              <PaginationItem key={`ellipsis-${index}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={item}>
                <PaginationLink type="button" isActive={item === page} disabled={disabled} onClick={() => onPageChange(item)}>
                  {item}
                </PaginationLink>
              </PaginationItem>
            ),
          )}
          <PaginationItem>
            <PaginationNext type="button" disabled={!hasNextPage || disabled} onClick={() => onPageChange(page + 1)} />
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
