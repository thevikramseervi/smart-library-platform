import { BrowserQRCodeReader } from "@zxing/browser";
import { Camera, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function QrCodeScanner({
  onScan,
  label = "Scan copy QR code",
}: {
  onScan: (value: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    let controls: { stop: () => void } | undefined;
    let animationFrame = 0;
    let mountWaitFrames = 0;
    const reader = new BrowserQRCodeReader();
    const startScanner = () => {
      if (!active) return;
      const video = videoRef.current;
      if (!video) {
        mountWaitFrames += 1;
        if (mountWaitFrames > 60) {
          setStarting(false);
          setError("The camera preview could not be initialized. Close this window and try again.");
          return;
        }
        animationFrame = window.requestAnimationFrame(startScanner);
        return;
      }

      void reader
        .decodeFromVideoDevice(undefined, video, (result, _error, scannerControls) => {
          controls = scannerControls;
          if (result && active) {
            active = false;
            scannerControls.stop();
            onScan(result.getText().trim());
            setOpen(false);
          }
        })
        .then((scannerControls) => {
          controls = scannerControls;
          if (active) setStarting(false);
          else scannerControls.stop();
        })
        .catch((cause: unknown) => {
          if (!active) return;
          setStarting(false);
          setError(
            cause instanceof Error && cause.name === "NotAllowedError"
              ? "Camera access was blocked. Allow camera access in your browser, or enter the inventory code manually."
              : "Could not start the camera. Use a secure connection (HTTPS or localhost), or enter the inventory code manually.",
          );
        });
    };
    animationFrame = window.requestAnimationFrame(startScanner);

    return () => {
      active = false;
      window.cancelAnimationFrame(animationFrame);
      controls?.stop();
    };
  }, [open, onScan]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="shrink-0"
        onClick={() => {
          setStarting(true);
          setError(null);
          setOpen(true);
        }}
      >
        <Camera aria-hidden="true" className="mr-2 size-4" />
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scan a copy QR code</DialogTitle>
            <DialogDescription>
              Point the camera at the QR label. Scanning only finds the copy; you will still review and confirm the circulation action.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-hidden rounded-xl bg-black">
            <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
          </div>
          {starting ? (
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> Starting camera…
            </p>
          ) : null}
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <p className="text-xs text-muted-foreground">Camera access requires permission and HTTPS, or localhost.</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
