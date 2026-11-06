import { useCallback, useEffect, useState } from "react";
import {
  getAdminProducts,
  setProductVisibility,
  type Product,
  type User,
} from "../api";

type UseAdminProductsOptions = {
  loading: boolean;
  isAdminProductsRoute: boolean;
  user: User | null;
  loadProducts: () => Promise<void>;
};

export function useAdminProducts({
  loading,
  isAdminProductsRoute,
  user,
  loadProducts,
}: UseAdminProductsOptions) {
  const [items, setItems] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState("");
  const [visibility, setVisibility] = useState<"active" | "hidden" | "all">(
    "active",
  );
  const [page, setPage] = useState(1);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const result = await getAdminProducts({
        search,
        visibility,
        page,
        pageSize: 10,
      });

      setItems(result.items);
      setTotalCount(result.totalCount);
      setTotalPages(result.totalPages);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load products.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [search, visibility, page]);

  const toggleVisibility = useCallback(
    async (product: Product) => {
      setActionId(product.id);
      setError("");

      try {
        await setProductVisibility(product.id, !product.isActive);
        await Promise.all([load(), loadProducts()]);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to update product visibility.",
        );
      } finally {
        setActionId(null);
      }
    },
    [load, loadProducts],
  );

  useEffect(() => {
    if (!loading && isAdminProductsRoute && user?.isAdmin) {
      void Promise.resolve().then(load);
    }
  }, [loading, isAdminProductsRoute, user, load]);

  return {
    items,
    isLoading,
    error,
    totalCount,
    totalPages,
    search,
    setSearch,
    visibility,
    setVisibility,
    page,
    setPage,
    actionId,
    load,
    toggleVisibility,
  };
}
