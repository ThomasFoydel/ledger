import { useState } from "react";
import {
  getCurrentUser,
  login,
  register,
  logout,
  type User,
} from "../api";

type UseAuthenticationOptions = {
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  setError: (message: string) => void;
  setSubmitting: (submitting: boolean) => void;
  loadProducts: () => Promise<void>;
  navigateToAdmin: () => void;
};

export function useAuthentication({
  setUser,
  setError,
  setSubmitting,
  loadProducts,
  navigateToAdmin,
}: UseAuthenticationOptions) {
  const [loginOpen, setLoginOpen] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await login(email, password);

      const currentUser = await getCurrentUser();

      if (!currentUser) {
        throw new Error("Sign-in succeeded, but your session could not be verified.");
      }

      setUser(currentUser);
      setPassword("");
      setLoginOpen(false);

      await loadProducts();
      if (currentUser.isAdmin) {
        navigateToAdmin();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await register(email, password);

      const currentUser = await getCurrentUser();

      if (!currentUser) {
        throw new Error(
          "Account created, but your sign-in session could not be verified.",
        );
      }

      setUser(currentUser);
      setPassword("");
      setLoginOpen(false);
      setIsRegistering(false);

      await loadProducts();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to create your account.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    setError("");
    setSubmitting(true);

    try {
      await logout();
      setUser(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign out.");
    } finally {
      setSubmitting(false);
    }
  }

  return {
    loginOpen,
    setLoginOpen,
    isRegistering,
    setIsRegistering,
    email,
    setEmail,
    password,
    setPassword,
    handleLogin,
    handleRegister,
    handleLogout,
  };
}
