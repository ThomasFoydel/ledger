import type { FormEvent } from "react";

type LoginDialogProps = {
  isRegistering: boolean;
  setIsRegistering: (value: boolean | ((current: boolean) => boolean)) => void;
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  error: string;
  setError: (value: string) => void;
  submitting: boolean;
  onLogin: (event: FormEvent<HTMLFormElement>) => void;
  onRegister: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
};

export default function LoginDialog({
  isRegistering,
  setIsRegistering,
  email,
  setEmail,
  password,
  setPassword,
  error,
  setError,
  submitting,
  onLogin,
  onRegister,
  onClose,
}: LoginDialogProps) {
  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) {
          onClose();
        }
      }}
    >
      <section
        className="login-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-title"
      >
        <button
          type="button"
          className="dialog-close"
          aria-label="Close sign-in dialog"
          onClick={onClose}
          disabled={submitting}
        >
          ×
        </button>

        <span className="brand-mark dialog-brand-mark" aria-hidden="true">
          L
        </span>
        <p className="eyebrow">WELCOME BACK</p>
        <h2 id="login-title">{isRegistering ? "Create your account" : "Sign in"}</h2>
        <p className="muted">
          {isRegistering
            ? "Create an account to place orders and track your purchases."
            : "Sign in to access your account."}
        </p>

        <form onSubmit={isRegistering ? onRegister : onLogin}>
          <div className="field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              required
              autoFocus
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              autoComplete={isRegistering ? "new-password" : "current-password"}
              minLength={isRegistering ? 8 : undefined}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          {error && (
            <p className="error-message" role="alert">{error}</p>
          )}

          <button
            type="submit"
            className="button button-primary dialog-submit"
            disabled={submitting}
          >
            {submitting
              ? (isRegistering ? "Creating account…" : "Signing in…")
              : (isRegistering ? "Create account" : "Sign in")}
          </button>
        </form>

        <p className="auth-switch">
          {isRegistering ? "Already have an account?" : "New here?"}{" "}
          <button
            type="button"
            className="auth-switch-button"
            onClick={() => {
              setIsRegistering((current) => !current);
              setError("");
            }}
            disabled={submitting}
          >
            {isRegistering ? "Sign in" : "Create an account"}
          </button>
        </p>
      </section>
    </div>
  );
}
