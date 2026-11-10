import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { QrCode } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { UserResponse } from "@/types/api";
import { generateStudentQrCode } from "@/lib/studentQr";

interface StudentQrCodeActionProps {
  student: UserResponse;
  compact?: boolean;
}

interface PrintableStudentQr {
  name: string;
  code: string;
  image: string;
}

export function StudentQrCodeAction({ student, compact = false }: StudentQrCodeActionProps) {
  const [open, setOpen] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [printLabel, setPrintLabel] = useState<PrintableStudentQr | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const studentCode = student.student_code;
  const name = `${student.first_name} ${student.last_name}`;

  async function showQrCode() {
    if (!studentCode) return;
    setOpen(true);
    setError(null);
    if (image) return;
    setLoading(true);
    try {
      setImage(await generateStudentQrCode(studentCode));
    } catch {
      setError("Unable to generate this student’s QR code.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!printLabel) return;
    const timer = window.setTimeout(() => window.print(), 250);
    const clearLabel = () => setPrintLabel(null);
    window.addEventListener("afterprint", clearLabel, { once: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", clearLabel);
    };
  }, [printLabel]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={compact ? "size-9 px-0" : undefined}
        disabled={!studentCode}
        onClick={() => void showQrCode()}
        aria-label="Student QR code"
        title={studentCode ? "View or print student QR code" : "This account has no student code"}
      >
        {compact ? <QrCode aria-hidden="true" className="size-4" /> : "Student QR"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Student QR code</DialogTitle>
            <DialogDescription>
              This QR contains only the student code. Scan it from Issue Book to find this account.
            </DialogDescription>
          </DialogHeader>
          {loading ? (
            <p role="status" className="py-8 text-center text-sm text-muted-foreground">Preparing QR code…</p>
          ) : error ? (
            <p role="alert" className="text-sm text-destructive">{error}</p>
          ) : image ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border bg-white p-5 text-center">
              <img src={image} alt={`QR code for ${studentCode}`} className="size-56 max-w-full" />
              <p className="font-semibold">{name}</p>
              <p className="text-sm text-muted-foreground">{studentCode}</p>
            </div>
          ) : null}
          <DialogFooter>
            {image ? (
              <>
                <Button variant="outline" asChild>
                  <a href={image} download={`student-${studentCode}-qr.png`}>Download PNG</a>
                </Button>
                <Button onClick={() => setPrintLabel({ name, code: studentCode!, image })}>
                  Print student QR
                </Button>
              </>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {printLabel ? createPortal(
        <div className="qr-print-root" aria-hidden="true">
          <article className="qr-print-label">
            <img src={printLabel.image} alt="" />
            <div>
              <p className="qr-print-title">{printLabel.name}</p>
              <p className="qr-print-code">{printLabel.code}</p>
              <p className="qr-print-location">Student</p>
            </div>
          </article>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
