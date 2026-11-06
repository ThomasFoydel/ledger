import { useCallback, useEffect, useState } from "react";
import {
  getAdminOrders,
  setOrderArchived,
  type AdminOrder,
  type User,
} from "../api";

type UseAdminOrdersOptions = {
  loading: boolean;
  isAdminOrdersRoute: boolean;
  user: User | null;
};

export function useAdminOrders({
  loading,
  isAdminOrdersRoute,
  user,
}: UseAdminOrdersOptions) {
  const [items, setItems] = useState<AdminOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState("");
  const [archiveFilter, setArchiveFilter] = useState<
    "active" | "archived" | "all"
  >("active");
  const [page, setPage] = useState(1);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const result = await getAdminOrders({
        search,
        archive: archiveFilter,
        page,
        pageSize: 10,
      });

      setItems(result.items);
      setTotalCount(result.totalCount);
      setTotalPages(result.totalPages);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load all orders.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [search, archiveFilter, page]);

  const toggleArchived = useCallback(
    async (order: AdminOrder) => {
      setActionId(order.id);
      setError("");

      try {
        await setOrderArchived(order.id, !order.isArchived);
        await load();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to update order archive status.",
        );
      } finally {
        setActionId(null);
      }
    },
    [load],
  );

  useEffect(() => {
    if (loading || !isAdminOrdersRoute || !user?.isAdmin) return;

    const timeoutId = window.setTimeout(() => {
      void load();
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [loading, isAdminOrdersRoute, user, load]);

  return {
    items,
    isLoading,
    error,
    totalCount,
    totalPages,
    search,
    setSearch,
    archiveFilter,
    setArchiveFilter,
    page,
    setPage,
    actionId,
    load,
    toggleArchived,
  };
}
