import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createUser,
  getUser,
  listDepartments,
  listRoles,
  resetUserPassword,
  updateUser,
} from "@/services/admin";
import { getApiErrorMessage } from "@/lib/apiError";
import { appToast } from "@/lib/toast";
import { CatalogPageHeader, FormSelect } from "@/pages/catalog/components/CatalogShared";

export function UserFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [roleId, setRoleId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [semester, setSemester] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [resetPassword, setResetPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const rolesQuery = useQuery({
    queryKey: ["roles"],
    queryFn: listRoles,
  });

  const departmentsQuery = useQuery({
    queryKey: ["departments"],
    queryFn: listDepartments,
  });

  const userQuery = useQuery({
    queryKey: ["users", id],
    queryFn: () => getUser(id!),
    enabled: isEdit,
  });

  useEffect(() => {
    if (userQuery.data) {
      setRoleId(userQuery.data.role.id);
      setDepartmentId(userQuery.data.department?.id ?? "");
      setFirstName(userQuery.data.first_name);
      setLastName(userQuery.data.last_name);
      setEmail(userQuery.data.email);
      setPhone(userQuery.data.phone ?? "");
      setStudentCode(userQuery.data.student_code ?? "");
      setSemester(userQuery.data.semester ? String(userQuery.data.semester) : "");
      setIsActive(userQuery.data.is_active);
    }
  }, [userQuery.data]);

  const selectedRoleName = useMemo(() => {
    return rolesQuery.data?.find((role) => role.id === roleId)?.name ?? "";
  }, [roleId, rolesQuery.data]);

  const isStudent = selectedRoleName === "STUDENT";

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        return updateUser(id!, {
          role_id: roleId,
          department_id: departmentId || null,
          first_name: firstName,
          last_name: lastName,
          email,
          phone: phone || null,
          password: password || undefined,
          student_code: isStudent ? studentCode : null,
          semester: isStudent ? Number(semester) : null,
          is_active: isActive,
        });
      }

      return createUser({
        role_id: roleId,
        department_id: departmentId || null,
        first_name: firstName,
        last_name: lastName,
        email,
        phone: phone || null,
        password,
        student_code: isStudent ? studentCode : null,
        semester: isStudent ? Number(semester) : null,
        is_active: isActive,
      });
    },
    onSuccess: () => {
      appToast[isEdit ? "updated" : "created"]("User");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      navigate("/admin/users");
    },
    onError: (error) => {
      setErrorMessage(getApiErrorMessage(error, "Unable to save user."));
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: () => resetUserPassword(id!, { password: resetPassword }),
    onSuccess: () => {
      appToast.success("Password reset successfully");
      setErrorMessage(null);
      setResetPassword("");
    },
    onError: (error) => {
      setErrorMessage(getApiErrorMessage(error, "Unable to reset password."));
    },
  });

  return (
    <section className="space-y-6">
      <CatalogPageHeader
        title={isEdit ? "Edit user" : "New user"}
        description={isEdit ? "Update account details." : "Create a new platform user."}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">User details</CardTitle>
        </CardHeader>
        <CardContent>
          {isEdit && userQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading user...</p>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                saveMutation.mutate();
              }}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <FormSelect
                  id="user-role"
                  label="Role"
                  value={roleId}
                  onChange={setRoleId}
                  required
                  options={(rolesQuery.data ?? []).map((role) => ({
                    value: role.id,
                    label: role.name,
                  }))}
                />
                <FormSelect
                  id="user-department"
                  label={isStudent ? "Department" : "Department (optional)"}
                  value={departmentId}
                  onChange={setDepartmentId}
                  required={isStudent}
                  options={(departmentsQuery.data ?? []).map((department) => ({
                    value: department.id,
                    label: `${department.code} — ${department.name}`,
                  }))}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="first-name">First name</Label>
                  <Input
                    id="first-name"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last-name">Last name</Label>
                  <Input
                    id="last-name"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                  />
                </div>
              </div>

              {isStudent ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="student-code">Student code</Label>
                    <Input
                      id="student-code"
                      value={studentCode}
                      onChange={(event) => setStudentCode(event.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="semester">Semester</Label>
                    <Input
                      id="semester"
                      type="number"
                      min={1}
                      value={semester}
                      onChange={(event) => setSemester(event.target.value)}
                      required
                    />
                  </div>
                </div>
              ) : null}

              {!isEdit ? (
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={8}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="password-update">New password (optional)</Label>
                  <Input
                    id="password-update"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={8}
                    placeholder="Leave blank to keep current password"
                  />
                </div>
              )}

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(event) => setIsActive(event.target.checked)}
                  className="size-4 rounded border-input"
                />
                Active account
              </label>

              {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

              <div className="flex gap-2">
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Saving..." : "Save user"}
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/admin/users">Cancel</Link>
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {isEdit ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reset password</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                resetPasswordMutation.mutate();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="reset-password">New password</Label>
                <Input
                  id="reset-password"
                  type="password"
                  value={resetPassword}
                  onChange={(event) => setResetPassword(event.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <Button type="submit" variant="outline" disabled={resetPasswordMutation.isPending}>
                {resetPasswordMutation.isPending ? "Resetting..." : "Reset password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
