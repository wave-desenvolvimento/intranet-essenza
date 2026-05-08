import { useState, useMemo } from "react";

interface UsePaginationOptions {
  pageSize?: number;
}

export function usePagination<T>(items: T[], options: UsePaginationOptions = {}) {
  const { pageSize = 24 } = options;
  const [page, setPage] = useState(0);

  const totalPages = Math.ceil(items.length / pageSize);
  const paginated = useMemo(
    () => items.slice(0, (page + 1) * pageSize),
    [items, page, pageSize]
  );

  const hasMore = (page + 1) * pageSize < items.length;
  const showing = Math.min((page + 1) * pageSize, items.length);

  function loadMore() {
    setPage((p) => p + 1);
  }

  function reset() {
    setPage(0);
  }

  return { paginated, hasMore, loadMore, reset, showing, total: items.length, page, totalPages };
}
