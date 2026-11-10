import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import QRCode from "qrcode";

import { BookCopyQrCodeAction } from "@/pages/catalog/components/BookCopyQrCodeAction";
import type { BookCopy } from "@/types/catalog";

vi.mock("qrcode", () => ({
  default: { toDataURL: vi.fn() },
}));

const copy = {
  id: "copy-1",
  book_id: "book-1",
  inventory_code: "INV-001",
  qr_code_value: "INV-001",
  location: "Shelf A1",
  status: "AVAILABLE",
  acquired_date: "2026-01-01",
} as BookCopy;

describe("BookCopyQrCodeAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(QRCode.toDataURL).mockResolvedValue("data:image/png;base64,copy-qr" as never);
  });

  it("previews the copy QR before offering download and print", async () => {
    render(<BookCopyQrCodeAction copy={copy} bookTitle="The Test Book" />);

    fireEvent.click(screen.getByRole("button", { name: "QR label for INV-001" }));

    expect(await screen.findByRole("heading", { name: "Copy QR label" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "QR code for copy INV-001" })).toHaveAttribute(
      "src",
      "data:image/png;base64,copy-qr",
    );
    expect(screen.getByText("The Test Book")).toBeInTheDocument();
    expect(screen.getByText("Shelf A1")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Download PNG" })).toHaveAttribute(
      "download",
      "copy-INV-001-qr.png",
    );

    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
    fireEvent.click(screen.getByRole("button", { name: "Print label" }));
    await waitFor(() => expect(printSpy).toHaveBeenCalledOnce());

    printSpy.mockRestore();
  });
});
