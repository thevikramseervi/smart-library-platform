import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/lib/apiError";
import { getCurrentUser, login } from "@/services/auth";
import { useAuthStore } from "@/store/authStore";

const FEATURES = [
  "Catalog Management",
  "Book Circulation",
  "Reservations",
  "Fine Tracking",
  "User Management",
] as const;

const DEV_ACCOUNTS = [
  { role: "Admin", email: "admin@library.local" },
  { role: "Librarian", email: "librarian@library.local" },
  { role: "Student", email: "student@library.local" },
] as const;

function getLoginErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    if (!error.response) {
      return "Network error. Check your connection and try again.";
    }
    if (error.response.status === 401) {
      return "Invalid credentials or inactive account. Check your email and password.";
    }
    return getApiErrorMessage(error, "Unable to sign in. Please try again.");
  }
  return "Unable to sign in. Please try again.";
}

export function LoginPage() {
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const setAuth = useAuthStore((state) => state.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loginMutation = useMutation({
    mutationFn: async () => {
      const tokenResponse = await login({ email, password });
      useAuthStore.setState({ token: tokenResponse.access_token });
      const user = await getCurrentUser();
      return { token: tokenResponse.access_token, user };
    },
    onSuccess: ({ token: accessToken, user }) => {
      setAuth(accessToken, user);
      navigate("/dashboard", { replace: true });
    },
    onError: (error) => {
      setErrorMessage(getLoginErrorMessage(error));
    },
  });

  const pending = loginMutation.isPending;

  if (token) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-svh bg-muted/30">
      <div className="mx-auto grid min-h-svh max-w-6xl items-center gap-10 px-6 py-10 lg:grid-cols-2 lg:py-16">
        <section className="space-y-8">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
              Smart Library Platform
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Library Management</h1>
            <p className="max-w-lg text-base text-muted-foreground">
              Modern library management for students, librarians, and administrators.
            </p>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2">
            {FEATURES.map((feature) => (
              <li
                key={feature}
                className="flex items-center gap-2 rounded-lg border bg-background px-4 py-3 text-sm"
              >
                <ArrowRight className="size-4 shrink-0 text-primary" aria-hidden="true" />
                {feature}
              </li>
            ))}
          </ul>
        </section>

        <section className="w-full">
          <Card className="mx-auto w-full max-w-md shadow-sm">
            <CardHeader>
              <CardTitle>Sign in</CardTitle>
              <CardDescription>Use your library account to continue.</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  setErrorMessage(null);
                  loginMutation.mutate();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={pending}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      disabled={pending}
                      required
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute top-1/2 right-1 h-8 w-8 -translate-y-1/2 px-0"
                      onClick={() => setShowPassword((current) => !current)}
                      disabled={pending}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </Button>
                  </div>
                </div>

                {errorMessage ? (
                  <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    {errorMessage}
                  </p>
                ) : null}

                <Button type="submit" className="w-full" disabled={pending}>
                  {pending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      Signing in...
                    </>
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </form>

              {import.meta.env.DEV ? (
                <Card className="mt-6 border-dashed bg-muted/40 shadow-none">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Development accounts</CardTitle>
                    <CardDescription className="text-xs">
                      Local seed users for testing. Passwords are not shown here.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {DEV_ACCOUNTS.map((account) => (
                      <div
                        key={account.email}
                        className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2"
                      >
                        <span className="font-medium">{account.role}</span>
                        <button
                          type="button"
                          className="text-left text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => setEmail(account.email)}
                        >
                          {account.email}
                        </button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : null}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
