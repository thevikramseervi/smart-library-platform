import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { QrCode } from "lucide-react";
import QRCode from "qrcode";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { BookCopy } from "@/types/catalog";

interface BookCopyQrCodeActionProps {
  copy: BookCopy;
  bookTitle: string;
}

export function BookCopyQrCodeAction({ copy, bookTitle }: BookCopyQrCodeActionProps) {
  const [open, setOpen] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printRequested, setPrintRequested] = useState(false);

  async function showQrCode() {
    setOpen(true);
    setError(null);
    if (image) return;

    setLoading(true);
    try {
      setImage(await QRCode.toDataURL(copy.qr_code_value, {
        width: 320,
        margin: 1,
        errorCorrectionLevel: "M",
      }));
    } catch {
      setError("Unable to generate this copy’s QR code.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!printRequested || !image) return;
    const timer = window.setTimeout(() => window.print(), 250);
    const clearPrintRequest = () => setPrintRequested(false);
    window.addEventListener("afterprint", clearPrintRequest, { once: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", clearPrintRequest);
    };
  }, [image, printRequested]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => void showQrCode()}
        aria-label={`QR label for ${copy.inventory_code}`}
        title={`View or print QR label for ${copy.inventory_code}`}
      >
        <QrCode aria-hidden="true" className="mr-1.5 size-3.5" /> QR label
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy QR label</DialogTitle>
            <DialogDescription>
              This QR code identifies this physical copy for circulation.
            </DialogDescription>
          </DialogHeader>
          {loading ? (
            <p role="status" className="py-8 text-center text-sm text-muted-foreground">
              Preparing QR code…
            </p>
          ) : error ? (
            <p role="alert" className="text-sm text-destructive">{error}</p>
          ) : image ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border bg-white p-5 text-center">
              <img src={image} alt={`QR code for copy ${copy.inventory_code}`} className="size-56 max-w-full" />
              <p className="font-semibold">{bookTitle}</p>
              <p className="text-sm text-muted-foreground">{copy.inventory_code}</p>
              {copy.location ? <p className="text-xs text-muted-foreground">{copy.location}</p> : null}
            </div>
          ) : null}
          <DialogFooter>
            {image ? (
              <>
                <Button variant="outline" asChild>
                  <a href={image} download={`copy-${copy.inventory_code}-qr.png`}>Download PNG</a>
                </Button>
                <Button onClick={() => {
                  setOpen(false);
                  setPrintRequested(true);
                }}>
                  Print label
                </Button>
              </>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {printRequested && image ? createPortal(
        <div className="qr-print-root" aria-hidden="true">
          <article className="qr-print-label">
            <img src={image} alt="" />
            <div>
              <p className="qr-print-title">{bookTitle}</p>
              <p className="qr-print-code">{copy.inventory_code}</p>
              {copy.location ? <p className="qr-print-location">{copy.location}</p> : null}
            </div>
          </article>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
