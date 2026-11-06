import { API_PREFIX, getCsrfToken } from "./client";

export type User = {
  email: string;
  isAdmin: boolean;
};

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

export async function register(email: string, password: string): Promise<void> {
  const requestToken = await getCsrfToken();

  const response = await fetch(`${API_PREFIX}/auth/register`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-TOKEN": requestToken,
    },
    body: JSON.stringify({ email, password }),
  });

  if (response.status === 409) {
    throw new Error("An account with this email already exists.");
  }

  if (response.status === 400 || response.status === 422) {
    const data = (await response.json().catch(() => null)) as {
      error?: string;
      errors?: Record<string, string[]>;
    } | null;

    const validationErrors = data?.errors
      ? Object.values(data.errors).flat()
      : [];

    throw new Error(
      data?.error ??
        validationErrors.join(" ") ??
        "Registration details are invalid.",
    );
  }

  if (!response.ok) {
    throw new Error("Could not create your account. Please try again.");
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
