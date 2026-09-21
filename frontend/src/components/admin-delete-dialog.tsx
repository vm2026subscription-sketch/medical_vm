import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { apiRequest } from "@/lib/api-client";
import { entryLabel } from "@/lib/admin-entry";
import { Btn, TextInput } from "./kit";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";

interface Preview {
  count: number;
  fingerprint: string;
  records: { _id: string; label: string }[];
  dependencies: { section: string; count: number }[];
}
export function AdminDeleteDialog({
  entity,
  ids,
  onClose,
  onDeleted,
}: {
  entity: string;
  ids: string[];
  onClose: () => void;
  onDeleted: () => void;
}) {
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let current = true;
    apiRequest<{ data: Preview }>("/admin/catalog-deletion/preview", {
      method: "POST",
      body: { entity, ids },
    })
      .then((result) => {
        if (current) setPreview(result.data);
      })
      .catch((err: Error) => {
        if (current) setError(err.message);
      });
    return () => {
      current = false;
    };
  }, [entity, ids]);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Delete {ids.length} {entryLabel(entity).toLowerCase()} record
            {ids.length === 1 ? "" : "s"}?
          </DialogTitle>
          <DialogDescription>
            These records will be removed from the website. The audit log keeps a copy of each
            deleted record.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-rose">
            {error}
          </p>
        )}
        {!preview && !error && <p>Checking selected records…</p>}
        {preview && (
          <>
            <ul className="max-h-40 overflow-y-auto text-sm">
              {preview.records.map((record) => (
                <li key={record._id} className="py-1">
                  {record.label}{" "}
                  <span className="text-xs text-muted">({record._id.slice(-6)})</span>
                </li>
              ))}
            </ul>
            {preview.dependencies.length ? (
              <div role="alert" className="rounded-xl bg-paper p-4 text-sm">
                <p>Delete these linked records first, then return here:</p>
                <ul>
                  {preview.dependencies.map((dependency) => (
                    <li key={dependency.section}>
                      {entryLabel(dependency.section)}: {dependency.count}
                    </li>
                  ))}
                </ul>
                <p className="mt-2">Nothing has been deleted.</p>
              </div>
            ) : (
              <>
                {entity === "colleges" && (
                  <p className="text-sm text-muted">
                    Saved-college bookmarks and import aliases for these colleges will also be
                    removed.
                  </p>
                )}
                <label className="grid gap-1 text-sm">
                  Reason for deletion
                  <TextInput
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="e.g. Duplicate or incorrectly entered record"
                    maxLength={500}
                    disabled={busy}
                  />
                </label>
                <Btn
                  disabled={busy || reason.trim().length < 3}
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    try {
                      await apiRequest("/admin/catalog-deletion/confirm", {
                        method: "POST",
                        body: {
                          entity,
                          ids,
                          reason: reason.trim(),
                          fingerprint: preview.fingerprint,
                        },
                      });
                      void router.invalidate();
                      onDeleted();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Deletion failed");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? "Deleting…" : `Confirm delete (${preview.count})`}
                </Btn>
              </>
            )}
          </>
        )}
        <Btn variant="ghost" disabled={busy} onClick={onClose}>
          Cancel
        </Btn>
      </DialogContent>
    </Dialog>
  );
}
