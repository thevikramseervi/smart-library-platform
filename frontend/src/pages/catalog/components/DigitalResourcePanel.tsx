import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QueryErrorState } from "@/components/ui/query-error-state";
import { appToast } from "@/lib/toast";
import { getApiErrorMessage } from "@/lib/apiError";
import {
  getDigitalResource,
  getDigitalResourceContent,
  removeDigitalResource,
  uploadDigitalResource,
} from "@/services/catalog/digital-resources";

const MAX_PDF_BYTES = 25 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DigitalResourcePanel({
  bookId,
  isDigital,
  isStaff,
}: {
  bookId: string;
  isDigital: boolean;
  isStaff: boolean;
}) {
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const resourceQuery = useQuery({
    queryKey: ["digital-resource", bookId],
    queryFn: () => getDigitalResource(bookId),
    enabled: isStaff || isDigital,
  });

  const refreshBookData = () => {
    void queryClient.invalidateQueries({ queryKey: ["digital-resource", bookId] });
    void queryClient.invalidateQueries({ queryKey: ["books", bookId] });
    void queryClient.invalidateQueries({ queryKey: ["books"] });
  };

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadDigitalResource(bookId, file),
    onSuccess: () => {
      setSelectedFile(null);
      setError(null);
      if (fileInput.current) fileInput.current.value = "";
      appToast.updated("Digital PDF");
      refreshBookData();
    },
    onError: (mutationError) => {
      setError(getApiErrorMessage(mutationError, "Unable to upload the PDF."));
    },
  });

  const removeMutation = useMutation({
    mutationFn: () => removeDigitalResource(bookId),
    onSuccess: () => {
      setConfirmRemove(false);
      setError(null);
      appToast.deleted("Digital PDF");
      refreshBookData();
    },
    onError: (mutationError) => {
      setConfirmRemove(false);
      setError(getApiErrorMessage(mutationError, "Unable to remove the PDF."));
    },
  });

  if (!isStaff && !isDigital) return null;

  async function openPdf() {
    const preview = window.open("about:blank", "_blank");
    if (!preview) {
      setError("Allow pop-ups to open the PDF in a new tab.");
      return;
    }
    preview.opener = null;
    try {
      const blob = await getDigitalResourceContent(bookId);
      const url = URL.createObjectURL(blob);
      preview.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (openError) {
      preview.close();
      setError(getApiErrorMessage(openError, "Unable to open the PDF."));
    }
  }

  async function downloadPdf() {
    try {
      const blob = await getDigitalResourceContent(bookId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = resourceQuery.data?.original_filename || "digital-book.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (downloadError) {
      setError(getApiErrorMessage(downloadError, "Unable to download the PDF."));
    }
  }

  function selectFile(file?: File) {
    setError(null);
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (!file.name.toLowerCase().endsWith(".pdf") || file.type !== "application/pdf") {
      setError("Choose a PDF file.");
      setSelectedFile(null);
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      setError("PDF files must be 25 MB or smaller.");
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
  }

  return (
    <Card>
      <CardHeader className="border-b border-border/60 pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="size-4 text-primary" aria-hidden="true" />
          Digital book
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        {resourceQuery.isLoading ? (
          <p role="status" className="text-sm text-muted-foreground">Checking for a digital PDF…</p>
        ) : resourceQuery.isError ? (
          <QueryErrorState
            message="Unable to check for a digital PDF."
            onRetry={() => void resourceQuery.refetch()}
          />
        ) : resourceQuery.data ? (
          <div className="flex flex-col justify-between gap-4 rounded-xl border border-border/70 bg-secondary/30 p-4 sm:flex-row sm:items-center">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{resourceQuery.data.original_filename}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                PDF · {formatFileSize(resourceQuery.data.file_size)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void openPdf()}>
                <FileText className="size-4" aria-hidden="true" />
                Open PDF
              </Button>
              <Button type="button" variant="outline" onClick={() => void downloadPdf()}>
                <Download className="size-4" aria-hidden="true" />
                Download
              </Button>
              {isStaff ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInput.current?.click()}
                  disabled={uploadMutation.isPending}
                >
                  <Upload className="size-4" aria-hidden="true" />
                  Replace PDF
                </Button>
              ) : null}
              {isStaff ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setConfirmRemove(true)}
                  disabled={removeMutation.isPending}
                  aria-label="Remove digital PDF"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              ) : null}
            </div>
          </div>
        ) : isStaff ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Attach a PDF students can open from this book’s details. Maximum file size: 25 MB.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInput.current?.click()}
              disabled={uploadMutation.isPending}
            >
              <Upload className="size-4" aria-hidden="true" />
              Choose PDF
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No digital PDF is available for this title.</p>
        )}

        {isStaff ? (
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            aria-label="Choose a digital book PDF"
            onChange={(event) => selectFile(event.currentTarget.files?.[0])}
          />
        ) : null}
        {selectedFile ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="max-w-full truncate text-muted-foreground">{selectedFile.name}</span>
            <Button
              type="button"
              size="sm"
              onClick={() => uploadMutation.mutate(selectedFile)}
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending ? "Uploading…" : "Upload PDF"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => selectFile(undefined)}
              disabled={uploadMutation.isPending}
            >
              Cancel
            </Button>
          </div>
        ) : null}
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      </CardContent>

      <Dialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove digital PDF?</DialogTitle>
            <DialogDescription>
              Students will no longer be able to open or download this file.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmRemove(false)}>
              Keep PDF
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => removeMutation.mutate()}
              disabled={removeMutation.isPending}
            >
              {removeMutation.isPending ? "Removing…" : "Remove PDF"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
