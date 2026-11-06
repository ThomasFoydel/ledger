import type { User } from "../api";
import { useAdminOrders } from "./useAdminOrders";
import { useAdminProducts } from "./useAdminProducts";

type UseAdminManagementOptions = {
  loading: boolean;
  isAdminProductsRoute: boolean;
  isAdminOrdersRoute: boolean;
  user: User | null;
  loadProducts: () => Promise<void>;
};

export function useAdminManagement({
  loading,
  isAdminProductsRoute,
  isAdminOrdersRoute,
  user,
  loadProducts,
}: UseAdminManagementOptions) {
  const products = useAdminProducts({
    loading,
    isAdminProductsRoute,
    user,
    loadProducts,
  });

  const orders = useAdminOrders({
    loading,
    isAdminOrdersRoute,
    user,
  });

  return { products, orders };
}
