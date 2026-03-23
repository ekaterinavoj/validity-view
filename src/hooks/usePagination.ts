import { useState, useMemo, useEffect } from "react";

export interface PaginationResult<T> {
  currentPage: number;
  setCurrentPage: (page: number) => void;
  totalPages: number;
  paginatedItems: T[];
  totalItems: number;
}

export function usePagination<T>(items: T[], itemsPerPage: number): PaginationResult<T> {
  const [currentPage, setCurrentPage] = useState(1);

  // Reset to page 1 when items count or itemsPerPage changes
  useEffect(() => {
    setCurrentPage(1);
  }, [items.length, itemsPerPage]);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

  // Clamp currentPage if it exceeds totalPages
  const safePage = Math.min(currentPage, totalPages);

  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * itemsPerPage;
    return items.slice(start, start + itemsPerPage);
  }, [items, safePage, itemsPerPage]);

  return {
    currentPage: safePage,
    setCurrentPage,
    totalPages,
    paginatedItems,
    totalItems,
  };
}
