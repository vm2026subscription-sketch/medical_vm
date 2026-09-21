import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Download, Plus, Search, Upload } from "lucide-react";
import { Btn, Panel, Skeleton, TextInput } from "./kit";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { apiRequest, apiUpload } from "@/lib/api-client";
import { AdminDeleteDialog } from "./admin-delete-dialog";
import {
  allowed,
  cellValue,
  downloadCsv,
  type AdminRecord,
  type AdminSession,
  type PageResult,
  type Resource,
  exampleFor,
  attentionFilters,
  type AttentionFilter,
  type MissingDataEntry,
} from "@/lib/admin";

export function AdminResourcePanel({
  resource,
  session,
  onDraft,
  onChanged,
  attention,
  onClearAttention,
  onMissingEntry,
}: {
  resource: Resource;
  session: AdminSession;
  onDraft?: (id: string) => void;
  onChanged?: () => void;
  attention?: AttentionFilter | undefined;
  onClearAttention?: () => void;
  onMissingEntry?: (entry: MissingDataEntry) => void;
}) {
  const [rows, setRows] = useState<AdminRecord[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [active, setActive] = useState("");
  const [year, setYear] = useState("");
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<AdminRecord | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<string[] | null>(null);
  const reviewedCatalog = [
    "colleges",
    "courses",
    "college-courses",
    "cutoffs",
    "fees",
    "seat-matrix",
    "hostel-fees",
    "bonds",
  ].includes(resource.key);
  const canDelete = reviewedCatalog && allowed(session, "imports:review");
  const canWrite =
    !reviewedCatalog && allowed(session, resource.writePermission || resource.permission);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setSelected([]);
    setError("");
    const params = new URLSearchParams({
      page: String(page),
      limit: "20",
      search: query,
      status,
      active,
    });
    if (year) params.set("year", year);
    if (attention === "photos") {
      params.set("missingImages", "true");
      params.set("active", "true");
    } else if (attention) params.set("missingData", attention);
    apiRequest<PageResult>(`${resource.path}?${params}`)
      .then((res) => {
        if (!current) return;
        setRows(res.data);
        setTotal(res.pagination?.total ?? res.data.length);
        setPages(res.pagination?.totalPages ?? 1);
      })
      .catch((err) => {
        if (current) {
          setError(err.message);
          setRows([]);
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [resource.path, page, query, status, active, year, revision, attention]);

  return (
    <Panel className="overflow-hidden">
      {attention && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line bg-teal-050 p-5">
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">{attentionFilters[attention].label}</h2>
            <p className="mt-1 text-xs text-muted">{attentionFilters[attention].description}</p>
          </div>
          <Btn variant="ghost" size="sm" onClick={onClearAttention}>
            Clear attention filter
          </Btn>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 border-b border-line p-5">
        <div className="mr-auto">
          <h2 className="text-lg">{resource.label}</h2>
          <p className="text-xs text-muted">
            {loading ? "Loading records…" : `${total.toLocaleString("en-IN")} records`}
          </p>
        </div>
        <Btn
          variant="ghost"
          size="sm"
          disabled={loading || !rows.length}
          onClick={() =>
            downloadCsv(`medpath-${resource.key}-page-${page}.csv`, [
              resource.columns.map((c) => c.label),
              ...rows.map((row) => resource.columns.map((c) => cellValue(row, c.key))),
            ])
          }
        >
          <Download className="size-4" /> Export this page
        </Btn>
        {canWrite && resource.createPath && (
          <Btn size="sm" onClick={() => setEditing({ _id: "" })}>
            <Plus className="size-4" /> Add {resource.key === "colleges" ? "college" : "record"}
          </Btn>
        )}
        {canDelete && (
          <Btn
            variant="ghost"
            size="sm"
            disabled={loading || !selected.length}
            onClick={() => setDeleting(selected)}
          >
            Delete selected ({selected.length})
          </Btn>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3 p-5">
        {resource.search && (
          <div className="relative min-w-52 flex-1">
            <Search className="absolute left-3 top-3 size-4 text-muted" />
            <TextInput
              aria-label="Search records"
              className="pl-9"
              placeholder={
                resource.key === "users" ? "Search name, email or phone" : "Search college or name"
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}
        {resource.statuses && (
          <select
            aria-label="Status filter"
            className="rounded-xl border border-line p-2 text-sm"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {resource.statuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        )}
        {resource.key === "colleges" && attention !== "photos" && (
          <select
            aria-label="Publication filter"
            className="rounded-xl border border-line p-2 text-sm"
            value={active}
            onChange={(e) => {
              setActive(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All colleges</option>
            <option value="true">Published</option>
            <option value="false">Unpublished</option>
          </select>
        )}
        {["cutoffs", "fees", "seat-matrix", "hostel-fees"].includes(resource.key) && (
          <TextInput
            aria-label="Year filter"
            className="w-32"
            placeholder="All years"
            type="number"
            min={2000}
            max={2100}
            value={year}
            onChange={(e) => {
              setYear(e.target.value);
              setPage(1);
            }}
          />
        )}
        <Btn variant="ghost" size="sm" disabled={loading} onClick={() => setRevision((r) => r + 1)}>
          Refresh
        </Btn>
      </div>
      {error ? (
        <div role="alert" className="px-5 pb-5 text-sm text-rose">
          {error}
        </div>
      ) : loading ? (
        <Skeleton className="m-5 h-56" />
      ) : !rows.length ? (
        <div className="p-12 text-center text-sm text-muted">
          {attention ? (
            "No matching records need attention. Clear the filter to view all records."
          ) : (
            <>
              No records found.{" "}
              {resource.fields && "Add a record or use Import data to get started."}
            </>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-paper text-xs text-muted">
              <tr>
                {canDelete && (
                  <th className="px-3">
                    <input
                      type="checkbox"
                      aria-label="Select all records on this page"
                      checked={rows.length > 0 && selected.length === rows.length}
                      onChange={(event) =>
                        setSelected(event.target.checked ? rows.map((row) => row._id) : [])
                      }
                    />
                  </th>
                )}
                {resource.columns.map((c) => (
                  <th key={c.key} className="whitespace-nowrap px-5 py-3">
                    {c.label}
                  </th>
                ))}
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row._id} className="border-t border-line-2 hover:bg-paper/70">
                  {canDelete && (
                    <td className="px-3">
                      <input
                        type="checkbox"
                        aria-label={`Select record ${row._id}`}
                        checked={selected.includes(row._id)}
                        onChange={(event) =>
                          setSelected((prior) =>
                            event.target.checked
                              ? [...prior, row._id]
                              : prior.filter((id) => id !== row._id),
                          )
                        }
                      />
                    </td>
                  )}
                  {resource.columns.map((c) => (
                    <td key={c.key} className="max-w-72 px-5 py-3">
                      <span className="line-clamp-3 break-words" title={cellValue(row, c.key)}>
                        {cellValue(row, c.key)}
                      </span>
                    </td>
                  ))}
                  <td className="px-5 py-3">
                    <div className="flex gap-2">
                      {canDelete && (
                        <Btn variant="ghost" size="sm" onClick={() => setDeleting([row._id])}>
                          Delete
                        </Btn>
                      )}
                      {(attention === "fees" || attention === "cutoffs") &&
                        allowed(session, "imports:write") &&
                        onMissingEntry && (
                          <Btn
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const college = row["collegeId"] as {
                                _id?: string;
                                collegeCode?: string;
                              } | null;
                              const course = row["courseId"] as { slug?: string } | null;
                              const code = college?.collegeCode || college?._id;
                              if (!code || !course?.slug) {
                                setError(
                                  "Linked college or course is unavailable. Check the course link before adding data.",
                                );
                                return;
                              }
                              onMissingEntry({
                                entity: attention,
                                input: { collegeCode: code, courseSlug: course.slug },
                              });
                            }}
                          >
                            {attention === "fees" ? "Add fees" : "Add cutoff"}
                          </Btn>
                        )}
                      {reviewedCatalog &&
                        attention !== "fees" &&
                        attention !== "cutoffs" &&
                        allowed(session, "imports:write") && (
                          <Btn
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              try {
                                const result = await apiRequest<{ data: { _id: string } }>(
                                  "/admin/imports/from-record",
                                  { method: "POST", body: { entity: resource.key, id: row._id } },
                                );
                                onDraft?.(result.data._id);
                              } catch (e) {
                                setError(e instanceof Error ? e.message : "Could not create draft");
                              }
                            }}
                          >
                            Edit via draft
                          </Btn>
                        )}
                      {canWrite &&
                        resource.fields &&
                        !(resource.key === "users" && row["role"] === "admin") &&
                        !(resource.key === "slots" && row["status"] !== "open") &&
                        !(
                          resource.key === "bookings" &&
                          !["confirmed", "completed", "no_show"].includes(String(row["status"]))
                        ) && (
                          <Btn variant="ghost" size="sm" onClick={() => setEditing(row)}>
                            Manage
                          </Btn>
                        )}
                      {resource.key === "colleges" && Boolean(row["isActive"]) && (
                        <Link
                          to="/colleges/$id"
                          params={{ id: row._id }}
                          className="self-center text-xs font-semibold text-teal-700"
                        >
                          View
                        </Link>
                      )}
                      {["users", "counsellors"].includes(resource.key) && (
                        <Btn
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard
                              .writeText(row._id)
                              .then(() => toast.success("ID copied"))
                              .catch(() => toast.error("Could not copy"));
                          }}
                        >
                          Copy ID
                        </Btn>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center justify-between border-t border-line p-4 text-xs text-muted">
        <span>
          Page {page} of {pages}
        </span>
        <div className="flex gap-2">
          <Btn
            size="sm"
            variant="ghost"
            disabled={loading || page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Btn>
          <Btn
            size="sm"
            variant="ghost"
            disabled={loading || page >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Btn>
        </div>
      </div>
      {editing && (
        <RecordEditor
          resource={resource}
          record={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setRevision((r) => r + 1);
          }}
        />
      )}
      {deleting && (
        <AdminDeleteDialog
          entity={resource.key}
          ids={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null);
            setSelected([]);
            setPage(1);
            setRevision((value) => value + 1);
            onChanged?.();
            toast.success("Selected records deleted");
          }}
        />
      )}
    </Panel>
  );
}

function RecordEditor({
  resource,
  record,
  onClose,
  onSaved,
}: {
  resource: Resource;
  record: AdminRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Record<string, string | boolean>>(() =>
    Object.fromEntries(
      (resource.fields || []).map((f) => {
        let value = record[f.key];
        if (f.type === "list") value = (Array.isArray(value) ? value : []).join("\n");
        if (f.type === "date" && value) {
          const d = new Date(String(value));
          value = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        }
        if (f.type === "checkbox") value = value ?? true;
        if (f.type === "select") value = value ?? f.options?.[0];
        return [f.key, f.type === "checkbox" ? Boolean(value) : String(value ?? "")];
      }),
    ),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [images, setImages] = useState<string[]>(record["images"] || []);
  const [imageUrl, setImageUrl] = useState("");
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body: Record<string, unknown> = {};
      for (const f of resource.fields || []) {
        if (["userId", "counsellorId"].includes(f.key) && record._id) continue;
        const value = values[f.key];
        if (f.type === "number") {
          if (value === "") {
            if (f.key === "usageLimit") body[f.key] = null;
            continue;
          }
          body[f.key] = Number(value);
        } else if (f.type === "list")
          body[f.key] = String(value)
            .split("\n")
            .map((s: string) => s.trim())
            .filter(Boolean);
        else if (f.type === "date") {
          if (value) body[f.key] = new Date(String(value)).toISOString();
        } else body[f.key] = typeof value === "string" ? value.trim() : value;
      }
      if (resource.key === "coupons") {
        if (new Date(String(body["validTo"])) <= new Date(String(body["validFrom"])))
          throw new Error("Expiry must be after the start date");
        if (body["type"] === "percent" && Number(body["value"]) > 100)
          throw new Error("Percent discount cannot exceed 100");
      }
      await apiRequest(record._id ? `${resource.path}/${record._id}` : resource.createPath!, {
        method: record._id ? resource.updateMethod || "PATCH" : "POST",
        body,
      });
      toast.success("Changes saved");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };
  const updateImages = async (next: string[]) => {
    setBusy(true);
    setError("");
    try {
      await apiRequest(`${resource.path}/${record._id}`, {
        method: "PATCH",
        body: { images: next },
      });
      setImages(next);
      toast.success("Gallery saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gallery update failed");
    } finally {
      setBusy(false);
    }
  };
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    if (images.length + files.length > 20) {
      setError("Maximum 20 images per college");
      return;
    }
    if (
      Array.from(files).some(
        (file) => file.size > 8 * 1024 * 1024 || !/^image\/(jpeg|png|webp|gif)$/.test(file.type),
      )
    ) {
      setError("Choose JPEG, PNG, WebP or GIF images under 8 MB each");
      return;
    }
    setBusy(true);
    setError("");
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        const res = await apiUpload<{ data: { images: string[] } }>(
          `/admin/colleges/${record._id}/images`,
          form,
        );
        setImages(res.data.images);
      }
      toast.success("Photos uploaded and saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onSaved();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {record._id ? "Manage" : "Add"} {resource.label}
          </DialogTitle>
          <DialogDescription>
            {record["name"] ||
              record["collegeCourseId"]?.collegeId?.name ||
              "Update the fields below and save your changes."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <fieldset disabled={busy} className="contents">
            {(resource.fields || [])
              .filter((f) => !(record._id && ["userId", "counsellorId"].includes(f.key)))
              .map((f) => (
                <label
                  key={f.key}
                  className={f.type === "textarea" || f.type === "list" ? "sm:col-span-2" : ""}
                >
                  <span className="mb-1 block text-xs font-semibold text-muted">
                    {f.label}
                    {f.required ? " *" : ""}
                  </span>
                  {f.type === "checkbox" ? (
                    <input
                      type="checkbox"
                      checked={Boolean(values[f.key])}
                      onChange={(e) => setValues({ ...values, [f.key]: e.target.checked })}
                      className="size-5 accent-teal-700"
                    />
                  ) : f.type === "select" ? (
                    <select
                      className="w-full rounded-xl border border-line bg-card p-3 text-sm"
                      value={String(values[f.key] ?? "")}
                      onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                    >
                      {f.options?.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  ) : f.type === "list" || f.type === "textarea" ? (
                    <textarea
                      placeholder={exampleFor(resource.key, f.key)}
                      className="min-h-24 w-full rounded-xl border border-line p-3 text-sm"
                      value={String(values[f.key] ?? "")}
                      onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                    />
                  ) : (
                    <TextInput
                      placeholder={exampleFor(resource.key, f.key)}
                      required={f.required}
                      type={
                        f.type === "date"
                          ? "datetime-local"
                          : f.type === "number"
                            ? "number"
                            : "text"
                      }
                      min={f.min}
                      max={f.max}
                      step={f.step || (f.type === "number" ? "1" : undefined)}
                      value={String(values[f.key] ?? "")}
                      onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                    />
                  )}
                </label>
              ))}
          </fieldset>
          <div className="flex gap-2 sm:col-span-2">
            <Btn disabled={busy} type="submit">
              {busy ? "Saving…" : "Save changes"}
            </Btn>
            <Btn disabled={busy} variant="ghost" type="button" onClick={onClose}>
              Cancel
            </Btn>
          </div>
        </form>
        {resource.key === "colleges" && (
          <section className="mt-3 border-t border-line pt-4">
            <h3 className="text-base">College gallery</h3>
            <p className="mt-1 text-xs text-muted">
              First photo is the cover. Gallery changes save immediately. Removing a photo here
              keeps the original in Cloudinary.
            </p>
            {!record._id ? (
              <p className="mt-3 text-sm text-muted">
                Save this college first, then open Manage to add photos.
              </p>
            ) : (
              <>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {images.map((url, index) => (
                    <div
                      key={`${url}-${index}`}
                      className="overflow-hidden rounded-xl border border-line"
                    >
                      <img
                        src={url}
                        alt={`Campus ${index + 1}`}
                        className="h-28 w-full object-cover"
                      />
                      <div className="flex flex-wrap gap-2 p-2">
                        <button
                          disabled={busy || index === 0}
                          className="text-xs text-teal-700 disabled:text-muted"
                          onClick={() =>
                            void updateImages([url, ...images.filter((_, i) => i !== index)])
                          }
                        >
                          {index === 0 ? "Cover" : "Make cover"}
                        </button>
                        <button
                          disabled={busy}
                          className="text-xs text-rose"
                          onClick={() => void updateImages(images.filter((_, i) => i !== index))}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <label className="mt-4 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-teal-100 bg-teal-050 p-4 text-sm font-semibold text-teal-700">
                  <Upload className="size-4" /> {busy ? "Working…" : "Upload campus photos"}
                  <input
                    disabled={busy}
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="sr-only"
                    onChange={(e) => {
                      void upload(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
                <p className="mt-1 text-xs text-muted">
                  Up to 20 photos. Maximum 8 MB each. Cloudinary stores uploads securely.
                </p>
                <form
                  className="mt-3 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!/^https:\/\//.test(imageUrl)) {
                      setError("Enter an HTTPS image URL");
                      return;
                    }
                    void updateImages([...images, imageUrl.trim()]);
                    setImageUrl("");
                  }}
                >
                  <TextInput
                    aria-label="Existing image URL"
                    type="url"
                    placeholder="Or paste an existing HTTPS image URL"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                  />
                  <Btn variant="ghost" disabled={busy || !imageUrl || images.length >= 20}>
                    Add URL
                  </Btn>
                </form>
              </>
            )}
          </section>
        )}
        {error && (
          <p role="alert" className="rounded-xl bg-rose-050 p-3 text-sm text-rose">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
