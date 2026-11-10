import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, LoaderCircle, LockKeyhole, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QueryErrorState } from "@/components/ui/query-error-state";
import { RoleBadge } from "@/components/ui/status-badge";
import { getApiErrorMessage } from "@/lib/apiError";
import { generateStudentQrCode } from "@/lib/studentQr";
import { changeMyPassword, getCurrentUser } from "@/services/auth";
import { useAuthStore } from "@/store/authStore";

export function ProfilePage() {
  const cachedUser = useAuthStore((state) => state.user);
  const profileQuery = useQuery({
    queryKey: ["profile", cachedUser?.id],
    queryFn: async () => {
      const currentUser = await getCurrentUser();
      useAuthStore.getState().setUser(currentUser);
      return currentUser;
    },
    enabled: Boolean(cachedUser),
    staleTime: 0,
    refetchOnMount: "always",
  });
  const user = profileQuery.data ?? cachedUser;
  const [qrResult, setQrResult] = useState<{
    studentCode: string;
    image?: string;
    error?: boolean;
  } | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const setToken = useAuthStore((state) => state.setToken);

  const passwordMutation = useMutation({
    mutationFn: () => changeMyPassword({
      current_password: currentPassword,
      new_password: newPassword,
    }),
    onSuccess: ({ access_token }) => {
      setToken(access_token);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordError(null);
      setPasswordChanged(true);
    },
    onError: (error) => {
      setPasswordChanged(false);
      setPasswordError(getApiErrorMessage(error, "Unable to change your password."));
    },
  });

  useEffect(() => {
    let active = true;
    if (user?.role.name !== "STUDENT" || !user.student_code) {
      return () => { active = false; };
    }
    void generateStudentQrCode(user.student_code).then((image) => {
      if (active) setQrResult({ studentCode: user.student_code!, image });
    }).catch(() => {
      if (active) setQrResult({ studentCode: user.student_code!, error: true });
    });
    return () => { active = false; };
  }, [user?.role.name, user?.student_code]);

  if (!user) return null;

  const fullName = `${user.first_name} ${user.last_name}`;
  const qr = qrResult?.studentCode === user.student_code ? qrResult : null;
  const profileDetails = [
    { label: "Email", value: user.email },
    { label: "Phone", value: user.phone || "Not provided" },
    { label: "Department", value: user.department ? `${user.department.code} — ${user.department.name}` : "Not assigned" },
    ...(user.role.name === "STUDENT"
      ? [
          { label: "Student code", value: user.student_code || "Not assigned" },
          { label: "Admission year", value: user.admission_year ? String(user.admission_year) : "Not provided" },
        ]
      : []),
  ];

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary/75">Your account</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">My Profile</h1>
        <p className="text-sm text-muted-foreground">View your account information and manage your password.</p>
      </header>

      {profileQuery.isError ? (
        <QueryErrorState
          message="Could not refresh your profile. Showing the last saved account details."
          onRetry={() => void profileQuery.refetch()}
        />
      ) : null}

      <Card className="overflow-hidden shadow-sm">
        <CardHeader className="flex flex-wrap items-center gap-4 border-b border-border/60 px-5 py-5 sm:px-6">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <UserRound aria-hidden="true" className="size-6" />
          </span>
          <div className="min-w-0 space-y-1">
            <CardTitle className="truncate text-lg">{fullName}</CardTitle>
            <CardDescription>{user.email}</CardDescription>
          </div>
          <RoleBadge role={user.role.name} />
        </CardHeader>
        <CardContent className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_auto]">
          <section aria-labelledby="profile-details-heading">
            <h2 id="profile-details-heading" className="text-sm font-semibold">Account details</h2>
            <dl className="mt-4 grid gap-x-8 gap-y-5 sm:grid-cols-2">
              {profileDetails.map((detail) => (
                <div key={detail.label} className="min-w-0">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{detail.label}</dt>
                  <dd className="mt-1 break-words text-sm font-medium">{detail.value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-6 text-xs text-muted-foreground">
              Need to update your account information? Please contact library administration.
            </p>
          </section>

          {user.role.name === "STUDENT" ? (
            <section aria-labelledby="profile-library-card-heading" className="w-full rounded-2xl border border-border/70 bg-muted/20 p-4 sm:w-64">
              <h2 id="profile-library-card-heading" className="text-sm font-semibold">My library card</h2>
              <p className="mt-1 text-xs text-muted-foreground">Show this code at the circulation desk.</p>
              {user.student_code ? (
                <div className="mt-4 flex flex-col items-center gap-3 rounded-xl bg-background p-4 text-center">
                  {qr?.image ? (
                    <img src={qr.image} alt={`Library QR code for ${user.student_code}`} className="size-44 rounded-lg border bg-white p-2" />
                  ) : qr?.error ? (
                    <p role="alert" className="text-sm text-destructive">Could not create your QR code.</p>
                  ) : (
                    <div role="status" className="flex size-44 items-center justify-center rounded-lg border bg-muted/30 text-muted-foreground">
                      <LoaderCircle aria-label="Creating QR code" className="size-5 animate-spin" />
                    </div>
                  )}
                  <p className="font-semibold">{user.student_code}</p>
                  {qr?.image ? (
                    <Button variant="outline" size="sm" asChild>
                      <a href={qr.image} download={`student-${user.student_code}-qr.png`}>
                        <Download aria-hidden="true" />
                        Download QR
                      </a>
                    </Button>
                  ) : null}
                </div>
              ) : (
                <p className="mt-4 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  A student code has not been assigned. Please contact library administration.
                </p>
              )}
              <p className="mt-3 text-center text-[11px] text-muted-foreground">The QR contains only your student code.</p>
            </section>
          ) : null}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="border-b border-border/60">
          <div className="flex items-center gap-2">
            <LockKeyhole aria-hidden="true" className="size-4 text-primary" />
            <CardTitle className="text-base">Change password</CardTitle>
          </div>
          <CardDescription>
            Enter your current password and choose a new one. Other signed-in sessions will be signed out.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="max-w-xl space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              setPasswordError(null);
              setPasswordChanged(false);
              if (newPassword !== confirmPassword) {
                setPasswordError("The new passwords do not match.");
                return;
              }
              passwordMutation.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">At least 8 characters.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                />
              </div>
            </div>
            {passwordError ? <p role="alert" className="text-sm text-destructive">{passwordError}</p> : null}
            {passwordChanged ? <p role="status" className="text-sm text-primary">Password changed. You remain signed in on this device.</p> : null}
            <Button
              type="submit"
              disabled={passwordMutation.isPending || newPassword.length < 8 || !currentPassword || !confirmPassword}
            >
              {passwordMutation.isPending ? "Changing password…" : "Change password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
