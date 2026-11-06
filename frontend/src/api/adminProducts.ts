import { API_PREFIX, getCsrfToken } from "./client";
import type { AdminProductFilters, PageResult, Product } from "./products";

export async function getAdminProducts(
  filters: AdminProductFilters = {},
): Promise<PageResult<Product>> {
  const params = new URLSearchParams();
  if (filters.search?.trim()) params.set("search", filters.search.trim());
  if (filters.visibility) params.set("visibility", filters.visibility);
  params.set("page", String(filters.page ?? 1));
  params.set("pageSize", String(filters.pageSize ?? 20));

  const response = await fetch(
    `${API_PREFIX}/admin/products?${params.toString()}`,
    { credentials: "include" },
  );

  if (response.status === 401 || response.status === 403) {
    throw new Error("You are not authorized to view products.");
  }
  if (!response.ok) throw new Error("Could not load products.");

  return response.json() as Promise<PageResult<Product>>;
}

export async function setProductVisibility(
  id: string,
  isActive: boolean,
): Promise<void> {
  const response = await fetch(
    `${API_PREFIX}/admin/products/${encodeURIComponent(id)}/visibility`,
    {
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": await getCsrfToken(),
      },
      body: JSON.stringify({ isActive }),
    },
  );

  if (response.status === 401 || response.status === 403) {
    throw new Error("You are not authorized to change product visibility.");
  }
  if (response.status === 404) throw new Error("Product not found.");
  if (!response.ok) throw new Error("Could not update product visibility.");
}
