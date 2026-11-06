import { useCallback, useEffect, useState } from "react";
import {
  getCurrentUser,
  getOrders,
  getProducts,
  getSiteSettings,
  type CustomerOrder,
  type Product,
  type SiteSettings,
  type User,
} from "../api";

type UseStorefrontDataOptions = {
  isOrdersRoute: boolean;
  search: string;
  setSiteSettings: (settings: SiteSettings) => void;
  setError: (message: string) => void;
};

export function useStorefrontData({
  isOrdersRoute,
  search,
  setSiteSettings,
  setError,
}: UseStorefrontDataOptions) {
  const [user, setUser] = useState<User | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<Product[] | null>(null);

  const loadProducts = useCallback(async () => {
    const items = await getProducts();
    setProducts(items);
  }, []);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrdersError("");
    try {
      setOrders(await getOrders());
    } catch (err) {
      setOrdersError(
        err instanceof Error ? err.message : "Unable to load your orders.",
      );
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && isOrdersRoute && user) {
      void Promise.resolve().then(() => loadOrders());
    }
  }, [loading, isOrdersRoute, user, loadOrders]);

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        const [currentUser, items, settings] = await Promise.all([
          getCurrentUser(),
          getProducts(),
          getSiteSettings(),
        ]);

        if (!active) return;

        setUser(currentUser);
        setProducts(items);
        setSiteSettings(settings);
      } catch {
        if (active) {
          setError(
            "Unable to load the store. Please check that the API is running and try again.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void initialize();

    return () => {
      active = false;
    };
  }, [setSiteSettings, setError]);

  useEffect(() => {
    const query = search.trim();

    if (!query) {
      return;
    }

    let active = true;

    const timeoutId = window.setTimeout(async () => {
      try {
        const results = await getProducts(query);
        if (active) setSearchResults(results);
      } catch (err) {
        if (active) {
          setSearchResults([]);
          setError(
            err instanceof Error ? err.message : "Unable to search products.",
          );
        }
      }
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [search, setError]);

  return {
    user,
    setUser,
    products,
    setProducts,
    orders,
    ordersLoading,
    ordersError,
    loading,
    searchResults,
    loadProducts,
    loadOrders,
  };
}
