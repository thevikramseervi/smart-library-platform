"""CLI wrapper for importing the real library catalog."""

from app.db.import_catalog import run_catalog_import

if __name__ == "__main__":
    from app.core.logging import setup_logging

    setup_logging()
    stats = run_catalog_import()
    print(
        "Import complete:",
        f"{stats.books_imported} books,",
        f"{stats.copies_generated} copies,",
        f"{stats.authors_created} authors,",
        f"{stats.publishers_created} publishers.",
    )
