"use client";

import { useRef, useState } from "react";
import { Download, FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { useApi } from "@/lib/client/useApi";
import { ClientApiError } from "@/lib/client/api";
import { formatDate } from "@/lib/ui/format";

interface DocumentItem {
  id: string;
  name: string;
  fileType: string;
  fileSize: number;
  createdAt: string;
}

export function DocumentsSection({ employeeId, canUpload }: { employeeId: string; canUpload: boolean }) {
  const { data, loading, error, refetch } = useApi<{ documents: DocumentItem[] }>(`/api/employees/${employeeId}/documents`);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/employees/${employeeId}/documents`, { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new ClientApiError(res.status, body?.error?.message || "Upload failed.");
      }
      if (fileRef.current) fileRef.current.value = "";
      refetch();
    } catch (err) {
      setUploadError(err instanceof ClientApiError ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      {canUpload && (
        <form onSubmit={onUpload} className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
            className="flex-1 rounded-[var(--df-radius-md)] border border-[var(--df-border-strong)] bg-[var(--df-bg-elevated)] px-3 py-2 text-xs text-[var(--df-text-secondary)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--df-primary)] file:px-3 file:py-1.5 file:text-xs file:text-white"
          />
          <Button type="submit" size="sm" variant="secondary" loading={uploading}>
            <Upload className="size-3.5" /> Upload
          </Button>
        </form>
      )}
      {uploadError && <Alert tone="danger">{uploadError}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}

      {loading && <p className="text-xs text-[var(--df-text-muted)]">Loading documents…</p>}

      {!loading && data && data.documents.length === 0 && (
        <EmptyState icon={FileText} title="No documents uploaded" description="PDF, PNG, JPEG, DOC or DOCX up to 5MB." />
      )}

      {data && data.documents.length > 0 && (
        <ul className="divide-y divide-[var(--df-border)] rounded-[var(--df-radius-md)] border border-[var(--df-border)]">
          {data.documents.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="size-4 shrink-0 text-[var(--df-text-muted)]" />
                <div className="min-w-0">
                  <p className="truncate text-sm text-[var(--df-text-primary)]">{doc.name}</p>
                  <p className="text-xs text-[var(--df-text-muted)]">
                    {formatDate(doc.createdAt)} · {(doc.fileSize / 1024).toFixed(0)} KB
                  </p>
                </div>
              </div>
              <a
                href={`/api/documents/${doc.id}/download`}
                className="flex items-center gap-1.5 shrink-0 rounded-md px-2 py-1.5 text-xs font-medium text-[var(--df-accent)] hover:bg-white/5"
              >
                <Download className="size-3.5" /> Download
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
