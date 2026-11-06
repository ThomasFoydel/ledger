import { API_PREFIX, getCsrfToken } from "./client";

export type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  isActive: boolean;
  createdAtUtcs: string;
  quantityOnHand: number;
  hasImage: boolean;
};

export type ProductInput = {
  name: string;
  description: string;
  price: number;
  quantityOnHand: number;
  tags: string[];
};

export type PageResult<T> = {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type AdminProductFilters = {
  search?: string;
  visibility?: "active" | "hidden" | "all";
  page?: number;
  pageSize?: number;
};

export function getProductImageUrl(id: string, version = 0): string {
  return `${API_PREFIX}/products/${encodeURIComponent(id)}/image?v=${version}`;
}

export async function uploadProductImage(
  id: string,
  file: File,
): Promise<void> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(
    `${API_PREFIX}/products/${encodeURIComponent(id)}/image`,
    {
      method: "POST",
      credentials: "include",
      headers: { "X-CSRF-TOKEN": await getCsrfToken() },
      body: formData,
    },
  );

  if (response.status === 401 || response.status === 403) {
    throw new Error("You are not authorized to upload product images.");
  }

  if (response.status === 404) {
    throw new Error("Product not found.");
  }

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as {
      error?: string;
      detail?: string;
      title?: string;
    } | null;

    throw new Error(
      data?.error ??
        data?.detail ??
        data?.title ??
        "Could not upload the product image.",
    );
  }
}

export async function getProductTags(id: string): Promise<string[]> {
  const response = await fetch(
    `${API_PREFIX}/products/${encodeURIComponent(id)}/tags`,
    { credentials: "include" },
  );

  if (response.status === 401 || response.status === 403) {
    throw new Error("You are not authorized to view product tags.");
  }

  if (response.status === 404) {
    throw new Error("Product not found.");
  }

  if (!response.ok) {
    throw new Error("Unable to load product tags.");
  }

  return response.json() as Promise<string[]>;
}

export async function getProducts(search = ""): Promise<Product[]> {
  const query = search.trim();
  const url = query
    ? `${API_PREFIX}/products?search=${encodeURIComponent(query)}`
    : `${API_PREFIX}/products`;

  const response = await fetch(url, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Could not load products.");
  }

  return response.json() as Promise<Product[]>;
}

export async function createProduct(product: ProductInput): Promise<Product> {
  const requestToken = await getCsrfToken();

  const response = await fetch(`${API_PREFIX}/products`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-TOKEN": requestToken,
    },
    body: JSON.stringify(product),
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error("You are not authorized to create products.");
  }
  if (response.status === 400) {
    throw new Error("Please check the product details and try again.");
  }
  if (!response.ok) {
    throw new Error("Could not create product.");
  }

  return response.json() as Promise<Product>;
}

export async function updateProduct(
  id: string,
  product: ProductInput,
): Promise<Product> {
  const response = await fetch(
    `${API_PREFIX}/products/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": await getCsrfToken(),
      },
      body: JSON.stringify(product),
    },
  );

  if (response.status === 401 || response.status === 403) {
    throw new Error("You are not authorized to edit products.");
  }
  if (response.status === 404) {
    throw new Error("Product not found.");
  }
  if (response.status === 400) {
    throw new Error("Please check the product details and try again.");
  }
  if (!response.ok) {
    throw new Error("Could not update product.");
  }

  return response.json() as Promise<Product>;
}

export async function deleteProduct(id: string): Promise<void> {
  const requestToken = await getCsrfToken();

  const response = await fetch(
    `${API_PREFIX}/products/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      credentials: "include",
      headers: { "X-CSRF-TOKEN": requestToken },
    },
  );

  if (response.status === 401 || response.status === 403) {
    throw new Error("You are not authorized to delete products.");
  }
  if (response.status === 404) {
    throw new Error("Product not found.");
  }
  if (!response.ok) {
    throw new Error("Could not delete product.");
  }
}
