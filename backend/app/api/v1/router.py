"""API v1 router aggregation."""

from fastapi import APIRouter

from app.api.v1.endpoints import (
    audit_logs,
    auth,
    authors,
    book_copies,
    book_search,
    books,
    categories,
    circulation,
    circulation_policies,
    dashboard,
    departments,
    digital_resources,
    fines,
    health,
    languages,
    notifications,
    publishers,
    ratings,
    recommendations,
    reports,
    reservations,
    roles,
    search_index,
    transactions,
    users,
)

api_router = APIRouter()
api_router.include_router(audit_logs.router, prefix="/audit-logs", tags=["audit-logs"])
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(roles.router, prefix="/roles", tags=["roles"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(departments.router, prefix="/departments", tags=["departments"])
api_router.include_router(
    digital_resources.router,
    prefix="/digital-resources",
    tags=["digital-resources"],
)
api_router.include_router(languages.router, prefix="/languages", tags=["languages"])
api_router.include_router(publishers.router, prefix="/publishers", tags=["publishers"])
api_router.include_router(authors.router, prefix="/authors", tags=["authors"])
api_router.include_router(categories.router, prefix="/categories", tags=["categories"])
api_router.include_router(book_search.router, prefix="/books", tags=["books"])
api_router.include_router(ratings.router, tags=["ratings"])
api_router.include_router(
    recommendations.router,
    prefix="/recommendations",
    tags=["recommendations"],
)
api_router.include_router(books.router, prefix="/books", tags=["books"])
api_router.include_router(search_index.router, prefix="/search-index", tags=["search-index"])
api_router.include_router(book_copies.router, prefix="/book-copies", tags=["book-copies"])
api_router.include_router(transactions.router, prefix="/transactions", tags=["transactions"])
api_router.include_router(reservations.router, prefix="/reservations", tags=["reservations"])
api_router.include_router(fines.router, prefix="/fines", tags=["fines"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(circulation.router, prefix="/circulation", tags=["circulation"])
api_router.include_router(
    circulation_policies.router, prefix="/circulation-policies", tags=["circulation-policies"]
)
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
