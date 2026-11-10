import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate, useLocation } from "react-router-dom";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminRoute } from "@/components/auth/AdminRoute";
import { StaffRoute } from "@/components/auth/StaffRoute";
import { TableListSkeleton } from "@/components/ui/table-list-skeleton";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { AdminLayout } from "@/layouts/AdminLayout";
import { CatalogLayout } from "@/layouts/CatalogLayout";
import { CirculationLayout } from "@/layouts/CirculationLayout";
import { MainLayout } from "@/layouts/MainLayout";
import { CirculationIndexRedirect } from "@/pages/circulation/CirculationIndexRedirect";
import { LoginPage } from "@/pages/LoginPage";

const ActiveLoansPage = lazy(() =>
  import("@/pages/circulation/ActiveLoansPage").then((m) => ({ default: m.ActiveLoansPage })));

const AuthorFormPage = lazy(() =>
  import("@/pages/catalog/AuthorFormPage").then((m) => ({ default: m.AuthorFormPage })));

const AuthorsListPage = lazy(() =>
  import("@/pages/catalog/AuthorsListPage").then((m) => ({ default: m.AuthorsListPage })));

const BookDetailPage = lazy(() =>
  import("@/pages/catalog/BookDetailPage").then((m) => ({ default: m.BookDetailPage })));

const BookFormPage = lazy(() =>
  import("@/pages/catalog/BookFormPage").then((m) => ({ default: m.BookFormPage })));

const BooksListPage = lazy(() =>
  import("@/pages/catalog/BooksListPage").then((m) => ({ default: m.BooksListPage })));

const CategoriesListPage = lazy(() =>
  import("@/pages/catalog/CategoriesListPage").then((m) => ({ default: m.CategoriesListPage })));

const CategoryFormPage = lazy(() =>
  import("@/pages/catalog/CategoryFormPage").then((m) => ({ default: m.CategoryFormPage })));

const DashboardPage = lazy(() =>
  import("@/pages/dashboard/DashboardPage").then((m) => ({ default: m.DashboardPage })));

const CirculationPolicyPage = lazy(() =>
  import("@/pages/admin/CirculationPolicyPage").then((m) => ({ default: m.CirculationPolicyPage })));

const SearchIndexPage = lazy(() =>
  import("@/pages/admin/SearchIndexPage").then((m) => ({ default: m.SearchIndexPage })));

const CirculationReportsPage = lazy(() =>
  import("@/pages/admin/CirculationReportsPage").then((m) => ({ default: m.CirculationReportsPage })));

const AuditLogPage = lazy(() =>
  import("@/pages/admin/AuditLogPage").then((m) => ({ default: m.AuditLogPage })));

const DepartmentFormPage = lazy(() =>
  import("@/pages/admin/DepartmentFormPage").then((m) => ({ default: m.DepartmentFormPage })));

const DepartmentsListPage = lazy(() =>
  import("@/pages/admin/DepartmentsListPage").then((m) => ({ default: m.DepartmentsListPage })));

const IssueBookPage = lazy(() =>
  import("@/pages/circulation/IssueBookPage").then((m) => ({ default: m.IssueBookPage })));

const LanguagesListPage = lazy(() =>
  import("@/pages/catalog/LanguagesListPage").then((m) => ({ default: m.LanguagesListPage })));

const MyFinesPage = lazy(() =>
  import("@/pages/circulation/MyFinesPage").then((m) => ({ default: m.MyFinesPage })));

const MyLoansPage = lazy(() =>
  import("@/pages/circulation/MyLoansPage").then((m) => ({ default: m.MyLoansPage })));

const NotificationsPage = lazy(() =>
  import("@/pages/NotificationsPage").then((m) => ({ default: m.NotificationsPage })));

const ProfilePage = lazy(() =>
  import("@/pages/ProfilePage").then((m) => ({ default: m.ProfilePage })));

const MyReservationsPage = lazy(() =>
  import("@/pages/circulation/MyReservationsPage").then((m) => ({ default: m.MyReservationsPage })));

const PublisherFormPage = lazy(() =>
  import("@/pages/catalog/PublisherFormPage").then((m) => ({ default: m.PublisherFormPage })));

const PublishersListPage = lazy(() =>
  import("@/pages/catalog/PublishersListPage").then((m) => ({ default: m.PublishersListPage })));

const ReservationsQueuePage = lazy(() =>
  import("@/pages/circulation/ReservationsQueuePage").then((m) => ({ default: m.ReservationsQueuePage })));

const StaffFinesPage = lazy(() =>
  import("@/pages/circulation/StaffFinesPage").then((m) => ({ default: m.StaffFinesPage })));

const UserFormPage = lazy(() =>
  import("@/pages/admin/UserFormPage").then((m) => ({ default: m.UserFormPage })));

const UsersListPage = lazy(() =>
  import("@/pages/admin/UsersListPage").then((m) => ({ default: m.UsersListPage })));

function LegacyLoansRedirect({ filter }: { filter: "all" | "overdue" }) {
  const location = useLocation();
  const state = location.state as { search?: string; inventoryCode?: string } | null;
  return (
    <Navigate
      to={{
        pathname: "/circulation/loans",
        search: filter === "overdue" ? "?filter=overdue" : "",
      }}
      replace
      state={{ search: state?.search ?? state?.inventoryCode ?? "" }}
    />
  );
}

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/",
    element: <ProtectedRoute />,
    children: [
      {
        element: <MainLayout />,
        children: [
          {
            index: true,
            element: <Navigate to="/dashboard" replace />,
          },
          {
            path: "dashboard",
            element: (
              <Suspense fallback={<TableListSkeleton columns={5} />}>
                <DashboardPage />
              </Suspense>
            ),
          },
          {
            path: "notifications",
            element: (
              <Suspense fallback={<TableListSkeleton columns={4} />}>
                <NotificationsPage />
              </Suspense>
            ),
          },
          {
            path: "profile",
            element: (
              <Suspense fallback={<TableListSkeleton columns={4} />}>
                <ProfilePage />
              </Suspense>
            ),
          },
          {
            path: "catalog",
            element: <CatalogLayout />,
            children: [
              {
                index: true,
                element: <Navigate to="/catalog/books" replace />,
              },
              {
                path: "languages",
                element: (
              <Suspense fallback={<TableListSkeleton columns={5} />}>
                <LanguagesListPage />
              </Suspense>
            ),
              },
              {
                path: "publishers",
                element: (
              <Suspense fallback={<TableListSkeleton columns={5} />}>
                <PublishersListPage />
              </Suspense>
            ),
              },
              {
                path: "authors",
                element: (
              <Suspense fallback={<TableListSkeleton columns={5} />}>
                <AuthorsListPage />
              </Suspense>
            ),
              },
              {
                path: "categories",
                element: (
              <Suspense fallback={<TableListSkeleton columns={5} />}>
                <CategoriesListPage />
              </Suspense>
            ),
              },
              {
                path: "books",
                element: (
              <Suspense fallback={<TableListSkeleton columns={5} />}>
                <BooksListPage />
              </Suspense>
            ),
              },
              {
                path: "books/:id",
                element: (
              <Suspense fallback={<TableListSkeleton columns={5} />}>
                <BookDetailPage />
              </Suspense>
            ),
              },
              {
                element: <StaffRoute />,
                children: [
                  {
                    path: "publishers/new",
                    element: (
              <Suspense fallback={<TableListSkeleton columns={5} />}>
                <PublisherFormPage />
              </Suspense>
            ),
                  },
                  {
                    path: "publishers/:id/edit",
                    element: (
              <Suspense fallback={<TableListSkeleton columns={5} />}>
                <PublisherFormPage />
              </Suspense>
            ),
                  },
                  {
                    path: "authors/new",
                    element: (
              <Suspense fallback={<TableListSkeleton columns={5} />}>
                <AuthorFormPage />
              </Suspense>
            ),
                  },
                  {
                    path: "authors/:id/edit",
                    element: (
              <Suspense fallback={<TableListSkeleton columns={5} />}>
                <AuthorFormPage />
              </Suspense>
            ),
                  },
                  {
                    path: "categories/new",
                    element: (
              <Suspense fallback={<TableListSkeleton columns={5} />}>
                <CategoryFormPage />
              </Suspense>
            ),
                  },
                  {
                    path: "categories/:id/edit",
                    element: (
              <Suspense fallback={<TableListSkeleton columns={5} />}>
                <CategoryFormPage />
              </Suspense>
            ),
                  },
                  {
                    path: "books/new",
                    element: (
              <Suspense fallback={<TableListSkeleton columns={5} />}>
                <BookFormPage />
              </Suspense>
            ),
                  },
                  {
                    path: "books/:id/edit",
                    element: (
              <Suspense fallback={<TableListSkeleton columns={5} />}>
                <BookFormPage />
              </Suspense>
            ),
                  },
                ],
              },
            ],
          },
          {
            path: "circulation",
            element: <CirculationLayout />,
            children: [
              {
                index: true,
                element: <CirculationIndexRedirect />,
              },
              {
                path: "my-loans",
                element: (
              <Suspense fallback={<TableListSkeleton columns={5} />}>
                <MyLoansPage />
              </Suspense>
            ),
              },
              {
                path: "my-reservations",
                element: (
              <Suspense fallback={<TableListSkeleton columns={5} />}>
                <MyReservationsPage />
              </Suspense>
            ),
              },
              {
                path: "my-fines",
                element: (
              <Suspense fallback={<TableListSkeleton columns={5} />}>
                <MyFinesPage />
              </Suspense>
            ),
              },
              {
                element: <StaffRoute />,
                children: [
                  {
                    path: "issue",
                    element: (
              <Suspense fallback={<TableListSkeleton columns={5} />}>
                <IssueBookPage />
              </Suspense>
            ),
                  },
                  {
                    path: "return",
                    element: <LegacyLoansRedirect filter="all" />,
                  },
                  {
                    path: "loans",
                    element: (
              <Suspense fallback={<TableListSkeleton columns={5} />}>
                <ActiveLoansPage />
              </Suspense>
            ),
                  },
                  {
                    path: "overdue",
                    element: <LegacyLoansRedirect filter="overdue" />,
                  },
                  {
                    path: "reservations",
                    element: (
              <Suspense fallback={<TableListSkeleton columns={5} />}>
                <ReservationsQueuePage />
              </Suspense>
            ),
                  },
                  {
                    path: "fines",
                    element: (
              <Suspense fallback={<TableListSkeleton columns={5} />}>
                <StaffFinesPage />
              </Suspense>
            ),
                  },
                ],
              },
            ],
          },
          {
            element: <AdminRoute />,
            children: [
              {
                path: "admin",
                element: <AdminLayout />,
                children: [
                  {
                    index: true,
                    element: <Navigate to="/admin/users" replace />,
                  },
                  {
                    path: "users",
                    element: (
              <Suspense fallback={<TableListSkeleton columns={5} />}>
                <UsersListPage />
              </Suspense>
            ),
                  },
                  {
                    path: "users/new",
                    element: (
              <Suspense fallback={<TableListSkeleton columns={5} />}>
                <UserFormPage />
              </Suspense>
            ),
                  },
                  {
                    path: "users/:id/edit",
                    element: (
              <Suspense fallback={<TableListSkeleton columns={5} />}>
                <UserFormPage />
              </Suspense>
            ),
                  },
                  {
                    path: "departments",
                    element: (
              <Suspense fallback={<TableListSkeleton columns={5} />}>
                <DepartmentsListPage />
              </Suspense>
            ),
                  },
                  {
                    path: "departments/new",
                    element: (
              <Suspense fallback={<TableListSkeleton columns={5} />}>
                <DepartmentFormPage />
              </Suspense>
            ),
                  },
                  {
                    path: "departments/:id/edit",
                    element: (
              <Suspense fallback={<TableListSkeleton columns={5} />}>
                <DepartmentFormPage />
              </Suspense>
            ),
                  },
                  {
                    path: "circulation-policy",
                    element: (
              <Suspense fallback={<TableListSkeleton columns={3} />}>
                <CirculationPolicyPage />
              </Suspense>
            ),
                  },
                  {
                    path: "search-index",
                    element: (
              <Suspense fallback={<TableListSkeleton columns={4} />}>
                <SearchIndexPage />
              </Suspense>
            ),
                  },
                  {
                    path: "analytics",
                    element: (
                      <Suspense fallback={<TableListSkeleton columns={4} />}>
                        <CirculationReportsPage />
                      </Suspense>
                    ),
                  },
                  {
                    path: "audit-log",
                    element: (
                      <Suspense fallback={<TableListSkeleton columns={4} />}>
                        <AuditLogPage />
                      </Suspense>
                    ),
                  },
                ],
              },
            ],
          },
          {
            path: "*",
            element: <NotFoundPage />,
          },
        ],
      },
    ],
  },
]);
