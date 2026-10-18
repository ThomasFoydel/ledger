const API_PREFIX = "/api";

type CsrfResponse = {
  requestToken: string;
};

export type User = {
  email: string;
};

export type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  isActive: boolean;
  createdAtUtcs: string;
};

export type ProductInput = {
  name: string;
  description: string;
  price: number;
};

async function getCsrfToken(): Promise<string> {
  const response = await fetch(`${API_PREFIX}/auth/csrf`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Could not initialize secure authentication.");
  }

  const data: CsrfResponse = await response.json();
  return data.requestToken;
}

export async function getCurrentUser(): Promise<User | null> {
  const response = await fetch(`${API_PREFIX}/auth/me`, {
    credentials: "include",
  });

  if (response.status === 401) return null;
  if (!response.ok) {
    throw new Error("Could not check your login session.");
  }

  return response.json() as Promise<User>;
}

export async function login(email: string, password: string): Promise<void> {
  const requestToken = await getCsrfToken();

  const response = await fetch(`${API_PREFIX}/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-TOKEN": requestToken,
    },
    body: JSON.stringify({ email, password }),
  });

  if (response.status === 401) {
    throw new Error("Invalid email or password.");
  }
  if (!response.ok) {
    throw new Error("Login failed. Please try again.");
  }
}

export async function logout(): Promise<void> {
  const requestToken = await getCsrfToken();

  const response = await fetch(`${API_PREFIX}/auth/logout`, {
    method: "POST",
    credentials: "include",
    headers: { "X-CSRF-TOKEN": requestToken },
  });

  if (!response.ok) {
    throw new Error("Logout failed. Please try again.");
  }
}

export async function getProducts(): Promise<Product[]> {
  const response = await fetch(`${API_PREFIX}/products`, {
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
  const requestToken = await getCsrfToken();

  const response = await fetch(
    `${API_PREFIX}/products/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": requestToken,
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
