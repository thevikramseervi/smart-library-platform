"""API v1 router aggregation."""

from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    authors,
    book_copies,
    books,
    categories,
    circulation,
    fines,
    health,
    languages,
    publishers,
    reservations,
    transactions,
)

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(languages.router, prefix="/languages", tags=["languages"])
api_router.include_router(publishers.router, prefix="/publishers", tags=["publishers"])
api_router.include_router(authors.router, prefix="/authors", tags=["authors"])
api_router.include_router(categories.router, prefix="/categories", tags=["categories"])
api_router.include_router(books.router, prefix="/books", tags=["books"])
api_router.include_router(book_copies.router, prefix="/book-copies", tags=["book-copies"])
api_router.include_router(transactions.router, prefix="/transactions", tags=["transactions"])
api_router.include_router(reservations.router, prefix="/reservations", tags=["reservations"])
api_router.include_router(fines.router, prefix="/fines", tags=["fines"])
api_router.include_router(circulation.router, prefix="/circulation", tags=["circulation"])
