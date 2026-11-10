import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DigitalResourcePanel } from "@/pages/catalog/components/DigitalResourcePanel";
import {
  getDigitalResource,
  uploadDigitalResource,
} from "@/services/catalog/digital-resources";

vi.mock("@/services/catalog/digital-resources", () => ({
  getDigitalResource: vi.fn(),
  getDigitalResourceContent: vi.fn(),
  removeDigitalResource: vi.fn(),
  uploadDigitalResource: vi.fn(),
}));

vi.mock("@/lib/toast", () => ({
  appToast: { updated: vi.fn(), deleted: vi.fn() },
}));

const resource = {
  id: "resource-1",
  book_id: "book-1",
  original_filename: "lecture-notes.pdf",
  file_size: 1024 * 1024,
  created_at: "2026-11-10T08:00:00Z",
};

function renderPanel(isStaff: boolean, isDigital = true) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <DigitalResourcePanel bookId="book-1" isDigital={isDigital} isStaff={isStaff} />
    </QueryClientProvider>,
  );
}

describe("DigitalResourcePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDigitalResource).mockResolvedValue(null);
    vi.mocked(uploadDigitalResource).mockResolvedValue(resource);
  });

  it("shows open and download actions to students when a PDF is available", async () => {
    vi.mocked(getDigitalResource).mockResolvedValue(resource);
    renderPanel(false);

    expect(await screen.findByText("lecture-notes.pdf")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open pdf/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /download/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /replace pdf/i })).not.toBeInTheDocument();
  });

  it("lets staff select and upload a PDF", async () => {
    const user = userEvent.setup();
    renderPanel(true, false);
    const file = new File(["%PDF-1.7\nfixture"], "new-book.pdf", { type: "application/pdf" });

    await user.upload(await screen.findByLabelText("Choose a digital book PDF"), file);
    expect(await screen.findByText("new-book.pdf")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Upload PDF" }));

    await waitFor(() => {
      expect(uploadDigitalResource).toHaveBeenCalledWith("book-1", file);
    });
  });

  it("does not render for a non-digital title viewed by a student", () => {
    const { container } = renderPanel(false, false);
    expect(container).toBeEmptyDOMElement();
    expect(getDigitalResource).not.toHaveBeenCalled();
  });
});
