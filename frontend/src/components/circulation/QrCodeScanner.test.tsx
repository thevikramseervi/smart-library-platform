import { fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const scanner = vi.hoisted(() => ({
  callback: undefined as ((
    result: { getText: () => string } | undefined,
    error: unknown,
    controls: { stop: () => void },
  ) => void) | undefined,
  preview: undefined as HTMLVideoElement | undefined,
  controls: { stop: vi.fn() },
}));

vi.mock("@zxing/browser", () => ({
  BrowserQRCodeReader: class {
    decodeFromVideoDevice(
      _deviceId: string | undefined,
      video: HTMLVideoElement | undefined,
      callback: typeof scanner.callback,
    ) {
      scanner.preview = video;
      scanner.callback = callback;
      return Promise.resolve(scanner.controls);
    }
  },
}));

import { QrCodeScanner } from "@/components/circulation/QrCodeScanner";

describe("QrCodeScanner", () => {
  it("passes the decoded inventory code to the circulation page and stops scanning", async () => {
    const onScan = vi.fn();
    render(<QrCodeScanner onScan={onScan} />);

    fireEvent.click(screen.getByRole("button", { name: "Scan copy QR code" }));
    await screen.findByRole("dialog", { name: "Scan a copy QR code" });
    await waitFor(() => expect(scanner.callback).toBeDefined());
    expect(scanner.preview).toBeInstanceOf(HTMLVideoElement);

    act(() => {
      scanner.callback?.({ getText: () => " INV-123 " }, undefined, scanner.controls);
    });

    expect(onScan).toHaveBeenCalledWith("INV-123");
    expect(scanner.controls.stop).toHaveBeenCalled();
  });
});
