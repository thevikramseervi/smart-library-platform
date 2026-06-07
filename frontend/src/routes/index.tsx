import { createBrowserRouter, Navigate } from "react-router-dom";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { StaffRoute } from "@/components/auth/StaffRoute";
import { CatalogLayout } from "@/layouts/CatalogLayout";
import { MainLayout } from "@/layouts/MainLayout";
import { AuthorFormPage } from "@/pages/catalog/AuthorFormPage";
import { AuthorsListPage } from "@/pages/catalog/AuthorsListPage";
import { BookDetailPage } from "@/pages/catalog/BookDetailPage";
import { BookFormPage } from "@/pages/catalog/BookFormPage";
import { BooksListPage } from "@/pages/catalog/BooksListPage";
import { CategoriesListPage } from "@/pages/catalog/CategoriesListPage";
import { CategoryFormPage } from "@/pages/catalog/CategoryFormPage";
import { LanguagesListPage } from "@/pages/catalog/LanguagesListPage";
import { PublisherFormPage } from "@/pages/catalog/PublisherFormPage";
import { PublishersListPage } from "@/pages/catalog/PublishersListPage";
import { CirculationLayout } from "@/layouts/CirculationLayout";
import { ActiveLoansPage } from "@/pages/circulation/ActiveLoansPage";
import { CirculationIndexRedirect } from "@/pages/circulation/CirculationIndexRedirect";
import { IssueBookPage } from "@/pages/circulation/IssueBookPage";
import { MyFinesPage } from "@/pages/circulation/MyFinesPage";
import { MyLoansPage } from "@/pages/circulation/MyLoansPage";
import { MyReservationsPage } from "@/pages/circulation/MyReservationsPage";
import { OverdueLoansPage } from "@/pages/circulation/OverdueLoansPage";
import { ReservationsQueuePage } from "@/pages/circulation/ReservationsQueuePage";
import { ReturnBookPage } from "@/pages/circulation/ReturnBookPage";
import { StaffFinesPage } from "@/pages/circulation/StaffFinesPage";
import { HomePage } from "@/pages/HomePage";
import { LoginPage } from "@/pages/LoginPage";

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
            element: <HomePage />,
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
                element: <LanguagesListPage />,
              },
              {
                path: "publishers",
                element: <PublishersListPage />,
              },
              {
                path: "authors",
                element: <AuthorsListPage />,
              },
              {
                path: "categories",
                element: <CategoriesListPage />,
              },
              {
                path: "books",
                element: <BooksListPage />,
              },
              {
                path: "books/:id",
                element: <BookDetailPage />,
              },
              {
                element: <StaffRoute />,
                children: [
                  {
                    path: "publishers/new",
                    element: <PublisherFormPage />,
                  },
                  {
                    path: "publishers/:id/edit",
                    element: <PublisherFormPage />,
                  },
                  {
                    path: "authors/new",
                    element: <AuthorFormPage />,
                  },
                  {
                    path: "authors/:id/edit",
                    element: <AuthorFormPage />,
                  },
                  {
                    path: "categories/new",
                    element: <CategoryFormPage />,
                  },
                  {
                    path: "categories/:id/edit",
                    element: <CategoryFormPage />,
                  },
                  {
                    path: "books/new",
                    element: <BookFormPage />,
                  },
                  {
                    path: "books/:id/edit",
                    element: <BookFormPage />,
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
                element: <MyLoansPage />,
              },
              {
                path: "my-reservations",
                element: <MyReservationsPage />,
              },
              {
                path: "my-fines",
                element: <MyFinesPage />,
              },
              {
                element: <StaffRoute />,
                children: [
                  {
                    path: "issue",
                    element: <IssueBookPage />,
                  },
                  {
                    path: "return",
                    element: <ReturnBookPage />,
                  },
                  {
                    path: "loans",
                    element: <ActiveLoansPage />,
                  },
                  {
                    path: "overdue",
                    element: <OverdueLoansPage />,
                  },
                  {
                    path: "reservations",
                    element: <ReservationsQueuePage />,
                  },
                  {
                    path: "fines",
                    element: <StaffFinesPage />,
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
]);
