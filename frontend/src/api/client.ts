export const API_PREFIX = import.meta.env.VITE_API_BASE_URL || "/api";

type CsrfResponse = {
  requestToken: string;
};

export async function getCsrfToken(): Promise<string> {
  const response = await fetch(`${API_PREFIX}/auth/csrf`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Could not initialize secure authentication.");
  }

  const data: CsrfResponse = await response.json();
  return data.requestToken;
}
