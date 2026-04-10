"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

type PaginationControlsProps = {
  page: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  disabled?: boolean;
  onPageChange: (page: number) => void;
};

export function PaginationControls({
  page,
  totalPages,
  hasPreviousPage,
  hasNextPage,
  disabled = false,
  onPageChange,
}: PaginationControlsProps) {
  const [pageInput, setPageInput] = useState(String(page));

  const visiblePages = getVisiblePages(page, totalPages);

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextPage = Number.parseInt(pageInput, 10);

    if (!Number.isFinite(nextPage)) {
      setPageInput(String(page));
      return;
    }

    const normalizedPage = Math.max(1, Math.min(nextPage, totalPages));
    onPageChange(normalizedPage);
  }

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-end">
      <Pagination className="mx-0 w-auto justify-start lg:justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              type="button"
              disabled={!hasPreviousPage || disabled}
              onClick={() => onPageChange(page - 1)}
            />
          </PaginationItem>
          {visiblePages.map((item, index) =>
            item === "ellipsis" ? (
              <PaginationItem key={`ellipsis-${index}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={item}>
                <PaginationLink
                  type="button"
                  isActive={item === page}
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
              disabled={!hasNextPage || disabled}
              onClick={() => onPageChange(page + 1)}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
      <form className="relative" onSubmit={handleSubmit}>
        <Input
          className="h-8 w-20 rounded-md pr-9 text-center text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          type="text"
          inputMode="numeric"
          value={pageInput}
          onChange={(event) => setPageInput(event.target.value)}
          aria-label="Jump to page"
          disabled={disabled}
        />
        <Button
          className="absolute right-1 top-1/2 h-6 -translate-y-1/2 rounded-sm px-1.5 text-[10px]"
          type="submit"
          variant="ghost"
          disabled={disabled}
        >
          Go
        </Button>
      </form>
    </div>
  );
}

function getVisiblePages(page: number, totalPages: number) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (page <= 3) {
    return [1, 2, 3, "ellipsis", totalPages] as const;
  }

  if (page >= totalPages - 2) {
    return [1, "ellipsis", totalPages - 2, totalPages - 1, totalPages] as const;
  }

  return [1, "ellipsis", page - 1, page, page + 1, "ellipsis", totalPages] as const;
}
