import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { ArrowRight, BookOpenCheck, Eye, EyeOff, Loader2, Sparkles } from "lucide-react";
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
      const user = await getCurrentUser(tokenResponse.access_token);
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
    <div className="min-h-svh bg-[radial-gradient(ellipse_at_18%_12%,oklch(0.87_0.075_147/32%),transparent_34rem)] px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto grid min-h-[calc(100svh-2.5rem)] max-w-7xl overflow-hidden rounded-[2rem] border border-border/70 bg-card/75 shadow-[0_30px_100px_-45px_oklch(0.2_0.04_160/0.38)] backdrop-blur sm:min-h-[calc(100svh-4rem)] lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative isolate flex min-h-72 flex-col justify-between overflow-hidden bg-primary px-7 py-8 text-primary-foreground sm:px-10 sm:py-11 lg:min-h-full lg:px-14 lg:py-14">
          <div className="absolute -top-32 -right-24 -z-10 size-[32rem] rounded-full border border-white/10 bg-white/[0.035]" />
          <div className="absolute top-24 -right-8 -z-10 size-72 rounded-full border border-white/10" />
          <div className="absolute right-12 bottom-12 -z-10 size-40 rotate-12 rounded-[2rem] border border-white/10 bg-white/[0.035]" />
          <div>
            <div className="flex items-center gap-3">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-white/12 ring-1 ring-white/20">
                <BookOpenCheck className="size-6" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-bold tracking-wide">Smart Library</p>
                <p className="text-xs text-primary-foreground/65">Campus knowledge hub</p>
              </div>
            </div>
            <div className="mt-12 max-w-xl space-y-5 lg:mt-20">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3 py-1.5 text-xs font-semibold tracking-wide text-primary-foreground/85">
                <Sparkles className="size-3.5" aria-hidden="true" />
                YOUR CAMPUS, IN GOOD READS
              </span>
              <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
                Make space for your next big idea.
              </h1>
              <p className="max-w-lg text-base leading-7 text-primary-foreground/72 sm:text-lg">
                Find your next read, keep track of what you borrow, and make library visits feel effortless.
              </p>
            </div>
          </div>

          <div className="mt-10">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-primary-foreground/55">
              Everything you need, all in one place
            </p>
            <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {FEATURES.map((feature) => (
                <li key={feature} className="flex items-center gap-2.5 text-sm text-primary-foreground/90">
                  <span className="flex size-5 items-center justify-center rounded-full bg-white/12">
                    <ArrowRight className="size-3" aria-hidden="true" />
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-10 sm:px-10 lg:px-14">
          <div className="w-full max-w-md">
            <div className="mb-8 space-y-2">
              <p className="text-sm font-semibold text-primary">Welcome back</p>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Sign in to your library</h2>
              <p className="text-sm leading-6 text-muted-foreground">Use your campus account to pick up where you left off.</p>
            </div>
            <Card className="gap-0 border-0 bg-transparent py-0 shadow-none">
              <CardContent className="px-0">
              <form
                className="space-y-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  setErrorMessage(null);
                  loginMutation.mutate();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-semibold">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@campus.edu"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={pending}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-sm font-semibold">Password</Label>
                    <span className="text-xs text-muted-foreground">Your account credentials</span>
                  </div>
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
                  <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    {errorMessage}
                  </p>
                ) : null}

                <Button type="submit" className="h-12 w-full rounded-xl text-sm shadow-lg shadow-primary/15" disabled={pending}>
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
                <Card className="mt-8 border-dashed bg-muted/45 shadow-none">
                  <CardHeader className="gap-1 px-4 pb-3 pt-4">
                    <CardTitle className="text-sm">Development accounts</CardTitle>
                    <CardDescription className="text-xs">
                      Local seed users for testing. Passwords are not shown here.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 px-4 pb-4 text-sm">
                    {DEV_ACCOUNTS.map((account) => (
                      <div
                        key={account.email}
                        className="flex items-center justify-between gap-3 rounded-xl border bg-card px-3 py-2.5"
                      >
                        <span className="font-semibold">{account.role}</span>
                        <button
                          type="button"
                          className="text-left text-xs text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            <p className="mt-7 text-center text-xs leading-5 text-muted-foreground">Your library account keeps your reading, reservations, and loan history together.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
