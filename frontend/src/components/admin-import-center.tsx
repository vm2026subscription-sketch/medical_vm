import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, FileSpreadsheet, PencilLine } from "lucide-react";
import { useRouter } from "@tanstack/react-router";
import { Btn, Panel, Pill, TextInput } from "./kit";
import { apiRequest } from "@/lib/api-client";
import { allowed, downloadCsv, type AdminSession, type MissingDataEntry } from "@/lib/admin";
import { cn } from "@/lib/utils";
import {
  entryTypes,
  entryLabel,
  fieldLabel,
  unavailableNumberFields,
  statusLabels,
  selectStyle,
  type EntryValues as Values,
  type EntryDefinition as Definition,
} from "@/lib/admin-entry";
import { EntryFields } from "./admin-entry-fields";
import { useCategoryOptions } from "@/lib/category-options";
interface Batch {
  _id: string;
  entity: string;
  source: string;
  sourceUrl?: string;
  filename: string;
  fileId?: string;
  status: string;
  revision: number;
  headers: string[];
  mapping: Values;
  defaults?: Values;
  totals: Record<string, number>;
  reviewNote?: string;
  createdAt: string;
}
interface ImportRow {
  row: number;
  input: Values;
  mapped?: Values;
  errors: string[];
  prepared?: {
    action: string;
    changedFields: string[];
    before: Record<string, unknown> | null;
    document: Record<string, unknown>;
    hostel?: {
      before: { amount: number | null } | null;
      document: { amount: number | null };
    } | null;
    alias?: { label: string; collegeId: string };
  };
}
interface Detail {
  batch: Batch;
  rows: ImportRow[];
  page: number;
}
interface Directory {
  colleges: { _id: string; name: string; city: string; importCode: string }[];
  total: number;
  page: number;
}
interface Preset {
  _id: string;
  name: string;
  entity: string;
  mapping: Values;
  defaults: Values;
}
async function get<T>(path: string): Promise<T> {
  return (await apiRequest<{ data: T }>(`/admin/imports${path}`)).data;
}
async function post<T>(path: string, body: unknown): Promise<T> {
  return (await apiRequest<{ data: T }>(`/admin/imports${path}`, { method: "POST", body })).data;
}
function download(file: { filename: string; base64: string; mime: string }) {
  const url = URL.createObjectURL(
    new Blob([Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0))], { type: file.mime }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = file.filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const show = (v: unknown, field?: string): string =>
  (field === "totalSeats" || (field && unavailableNumberFields.has(field))) && v == null
    ? "N/A"
    : v == null || v === ""
      ? "—"
      : Array.isArray(v)
        ? v.map((value) => show(value)).join(", ")
        : typeof v === "object"
          ? Object.entries(v)
              .map(([key, value]) => `${fieldLabel(key)}: ${show(value, key)}`)
              .join(", ")
          : String(v);
export function AdminImportPanel({
  session,
  initialBatchId,
  initialEntry,
  workspace = "entry",
  onDirtyChange,
  onBusyChange,
}: {
  session: AdminSession;
  initialBatchId?: string;
  initialEntry?: MissingDataEntry;
  workspace?: "entry" | "history" | "review";
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const router = useRouter();
  const categories = useCategoryOptions("admin");
  const [courses, setCourses] = useState<{ slug: string; name: string }[]>([]);
  const [entity, setEntity] = useState(initialEntry?.entity || "");
  const [mode, setMode] = useState(initialEntry ? "manual" : "file");
  const [source, setSource] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [sheet, setSheet] = useState("");
  const [input, setInput] = useState<Values>(initialEntry?.input || {});
  const [list, setList] = useState<{ batches: Batch[]; total: number; page: number }>({
    batches: [],
    total: 0,
    page: 1,
  });
  const [status, setStatus] = useState(workspace === "review" ? "submitted" : "");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [mapping, setMapping] = useState<Values>({});
  const [defaults, setDefaults] = useState<Values>({});
  const [overrides, setOverrides] = useState<Record<string, Values>>({});
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [note, setNote] = useState("");
  const [batchSource, setBatchSource] = useState("");
  const [batchSourceUrl, setBatchSourceUrl] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [directory, setDirectory] = useState<Directory>({ colleges: [], total: 0, page: 1 });
  const [search, setSearch] = useState("");
  const definition = definitions.find((d) => d.entity === entity);
  const current = definitions.find((d) => d.entity === detail?.batch.entity);
  const review = allowed(session, "imports:review");
  const editable =
    !!detail && ["draft", "needs_correction", "ready", "rejected"].includes(detail.batch.status);
  const changed =
    !!detail &&
    (batchSource !== detail.batch.source ||
      batchSourceUrl !== (detail.batch.sourceUrl || "") ||
      Object.keys(overrides).length > 0 ||
      JSON.stringify(mapping) !== JSON.stringify(detail.batch.mapping) ||
      JSON.stringify(defaults) !== JSON.stringify(detail.batch.defaults || {}));
  const dirty = detail
    ? editable && changed
    : workspace === "entry" &&
      !!(source || sourceUrl || file || Object.values(input).some(Boolean));
  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    onBusyChange?.(busy);
    return () => onBusyChange?.(false);
  }, [busy, onBusyChange]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty || busy) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, busy]);
  const canLeave = () =>
    !dirty ||
    window.confirm("Discard your unsaved changes? Saved entries remain in Entry history.");
  const run = async (fn: () => Promise<void>) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not complete this step. Please retry.");
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  const refreshList = async (page = 1, filter = status) =>
    setList(await get(`?page=${page}&status=${encodeURIComponent(filter)}`));
  const open = async (id: string, page = 1) => {
    const result = await get<Detail>(`/${id}?page=${page}`);
    setDetail(result);
    setMapping(result.batch.mapping || {});
    setDefaults(result.batch.defaults || {});
    setOverrides({});
    setNote("");
    setBatchSource(result.batch.source);
    setBatchSourceUrl(result.batch.sourceUrl || "");
    return result;
  };
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      get<Definition[]>("/meta"),
      get<Preset[]>("/presets"),
      get<typeof list>(`?status=${workspace === "review" ? "submitted" : ""}`),
      apiRequest<{ data: { slug: string; name: string }[] }>("/courses", { auth: false }).catch(
        () => ({ data: [] }),
      ),
    ])
      .then(([meta, saved, batches, availableCourses]) => {
        if (active) {
          setDefinitions(meta);
          setPresets(saved);
          setList(batches);
          setCourses(availableCourses.data);
        }
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [workspace, attempt]);
  useEffect(() => {
    if (initialBatchId)
      void run(async () => {
        await open(initialBatchId);
      });
  }, [initialBatchId]);
  const resetEntry = () => {
    setSource("");
    setSourceUrl("");
    setFile(null);
    setSheet("");
    setSheets([]);
    setInput({});
  };
  const create = async () => {
    if (source.trim().length < 2)
      throw new Error("Enter the official notice, website or prospectus used for this data.");
    let batch: Batch;
    if (mode === "manual")
      batch = await post("/manual", { entity, source, ...(sourceUrl ? { sourceUrl } : {}), input });
    else {
      if (!file) throw new Error("Choose an Excel or CSV file first.");
      const data = new FormData();
      data.append("file", file);
      data.append("entity", entity);
      data.append("source", source);
      if (sourceUrl) data.append("sourceUrl", sourceUrl);
      if (sheet) data.append("sheet", sheet);
      batch = await post("/upload", data);
    }
    await open(batch._id);
    resetEntry();
    const checked = await post<Batch>(`/${batch._id}/validate`, {
      revision: batch.revision,
      mapping: batch.mapping || {},
      defaults: batch.defaults || {},
    });
    await open(batch._id);
    await refreshList();
    setMessage(
      checked.status === "ready"
        ? "Data checked. Look over the preview, then send it for approval."
        : "Entry saved. Fix the highlighted rows before sending it for approval.",
    );
  };
  const validate = async () => {
    if (!detail) return;
    const checked = await post<Batch>(`/${detail.batch._id}/validate`, {
      revision: detail.batch.revision,
      mapping,
      defaults,
      overrides,
      source: batchSource,
      sourceUrl: batchSourceUrl,
    });
    await open(detail.batch._id, detail.page);
    await refreshList();
    setMessage(
      checked.status === "ready"
        ? "All rows checked. Ready to send for approval."
        : "Changes saved. Some rows still need attention.",
    );
  };
  const action = async (name: string) => {
    if (!detail) return;
    await post(`/${detail.batch._id}/${name}`, {
      revision: detail.batch.revision,
      ...(name === "reject" ? { note } : {}),
    });
    await open(detail.batch._id);
    await refreshList();
    if (name === "publish") void router.invalidate();
    setMessage(
      name === "publish"
        ? "Published. These records are now on the website."
        : name === "submit"
          ? "Sent for approval. Track this entry in Entry history."
          : "Returned to the data-entry person with your note.",
    );
  };
  const inspectFile = async (chosen: File | undefined) => {
    setFile(null);
    setSheets([]);
    setSheet("");
    if (!chosen) return;
    if (chosen.size > 10 * 1024 * 1024) throw new Error("Choose a file smaller than 10 MB.");
    const data = new FormData();
    data.append("file", chosen);
    const result = await post<{ sheets: string[]; sheet: string; total: number }>("/inspect", data);
    setFile(chosen);
    setSheets(result.sheets);
    setSheet(result.sheet);
  };
  const uploadPhoto = async (
    chosen: File | undefined,
    values: Values,
    save: (v: Values) => void,
  ) => {
    if (!chosen) return;
    const data = new FormData();
    data.append("file", chosen);
    const result = await post<{ url: string }>("/images", data);
    save({
      ...values,
      images: [values["images"] === "[]" ? "" : values["images"], result.url]
        .filter(Boolean)
        .join("|"),
    });
    setMessage(
      "Photo uploaded. Save this entry and send it for approval to show it on the website.",
    );
  };
  const rowValues = (row: ImportRow): Values =>
    Object.fromEntries(
      (current?.fields || []).map((f) => [
        f.key,
        overrides[String(row.row)]?.[f.key] ??
          row.mapped?.[f.key] ??
          (row.input[mapping[f.key] || ""] || defaults[f.key] || ""),
      ]),
    );
  const correctRow = (row: ImportRow, values: Values) => {
    const previous = rowValues(row);
    const edits = Object.fromEntries(
      Object.entries(values).filter(([key, value]) => value !== previous[key]),
    );
    setOverrides((saved) => ({
      ...saved,
      [String(row.row)]: { ...saved[String(row.row)], ...edits },
    }));
  };
  const missingMappings =
    current?.fields.filter((f) => f.required && !mapping[f.key] && !defaults[f.key]).length || 0;
  const back = () => {
    if (canLeave()) {
      setDetail(null);
      setEntity("");
      setOverrides({});
      setMessage("");
      setError("");
      resetEntry();
    }
  };
  const photoInput = (values: Values, save: (v: Values) => void) => (
    <label className="grid gap-2 rounded-xl bg-paper p-4 text-sm">
      Add college photo
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={(e) => {
          const chosen = e.target.files?.[0];
          e.target.value = "";
          void run(() => uploadPhoto(chosen, values, save));
        }}
      />
      <span className="text-xs text-muted">
        Up to 8 MB per photo. The first photo is the cover.
      </span>
      {!!values["images"] && values["images"] !== "[]" && (
        <span className="text-xs text-teal-700">
          {values["images"].split("|").filter(Boolean).length} photo(s) attached
        </span>
      )}
    </label>
  );
  return (
    <div className="mx-auto grid max-w-5xl gap-5">
      {error && (
        <div role="alert" className="rounded-xl border border-rose bg-card p-4 text-sm text-rose">
          {error}
          {!definitions.length && (
            <Btn size="sm" className="ml-3" onClick={() => setAttempt((n) => n + 1)}>
              Retry
            </Btn>
          )}
        </div>
      )}
      {message && (
        <p role="status" className="rounded-xl bg-teal-050 p-4 text-sm text-teal-800">
          {message}
        </p>
      )}
      {loading ? (
        <p className="p-6 text-sm text-muted">Loading entry formats…</p>
      ) : (
        <>
          {!detail && workspace === "entry" && !entity && (
            <>
              <div>
                <h2 className="text-2xl">What would you like to add?</h2>
                <p className="mt-2 text-sm text-muted">
                  Choose a section. Add a file or fill a form, check the preview, then send it for
                  approval.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {entryTypes
                  .filter(
                    (t) => t.key !== "hostel-fees" && definitions.some((d) => d.entity === t.key),
                  )
                  .map((t) => (
                    <button
                      key={t.key}
                      disabled={busy}
                      onClick={() => {
                        setEntity(t.key);
                        setMode("file");
                      }}
                      className="rounded-2xl border border-line bg-card p-5 text-left shadow-sm transition hover:border-teal-500 hover:bg-teal-050 focus-visible:outline-2 focus-visible:outline-teal-600"
                    >
                      <span className="mb-4 inline-flex size-9 items-center justify-center rounded-xl bg-teal-050 text-sm font-bold text-teal-700">
                        {t.icon}
                      </span>
                      <span className="block text-lg font-semibold">{t.label}</span>
                      <span className="mt-1 block text-sm text-muted">{t.description}</span>
                    </button>
                  ))}
              </div>
              <p className="rounded-xl bg-teal-050 p-4 text-sm text-teal-800">
                Starting fresh? Add colleges and courses first, then connect them under College
                courses. Fees, seats and cutoffs use that same college code and course.
              </p>
            </>
          )}
          {!detail && workspace === "entry" && definition && (
            <>
              <div className="flex items-center gap-3">
                <Btn variant="ghost" size="sm" disabled={busy} onClick={back}>
                  <ArrowLeft className="size-4" /> All sections
                </Btn>
                <h2 className="text-xl">
                  Add {entity === "hostel-fees" ? "fees" : entryLabel(entity).toLowerCase()}
                </h2>
              </div>
              <Panel className="p-5 md:p-6">
                <fieldset disabled={busy} className="grid gap-5">
                  <div className="grid grid-cols-2 gap-2" role="group" aria-label="Entry method">
                    {[
                      { value: "file", label: "Upload Excel", icon: FileSpreadsheet },
                      { value: "manual", label: "Fill a form", icon: PencilLine },
                    ].map((m) => (
                      <button
                        key={m.value}
                        aria-pressed={mode === m.value}
                        onClick={() => {
                          if (mode !== m.value && canLeave()) {
                            resetEntry();
                            setMode(m.value);
                          }
                        }}
                        className={cn(
                          "flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-semibold",
                          mode === m.value
                            ? "border-teal-600 bg-teal-050 text-teal-800"
                            : "border-line bg-card",
                        )}
                      >
                        <m.icon className="size-4" />
                        {m.label}
                      </button>
                    ))}
                  </div>
                  {mode === "file" ? (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-paper p-4">
                        <div>
                          <p className="text-sm font-semibold">
                            Sample sheet for {entryLabel(entity).toLowerCase()}
                          </p>
                          <p className="mt-1 text-xs text-muted">
                            Replace the example rows with your data. Matching headings are checked
                            automatically.
                          </p>
                        </div>
                        <Btn
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            void run(async () => download(await get(`/templates/${entity}`)))
                          }
                        >
                          Download sample Excel
                        </Btn>
                      </div>
                      <label className="grid gap-3 rounded-xl border-2 border-dashed border-line p-5 text-sm">
                        Choose Excel or CSV file
                        <input
                          type="file"
                          accept=".csv,.xlsx"
                          onChange={(e) => {
                            const chosen = e.target.files?.[0];
                            e.target.value = "";
                            void run(() => inspectFile(chosen));
                          }}
                        />
                        <span className="text-xs text-muted">
                          Up to 2,000 rows per sheet, 10 MB per file. Paste formulas as values.
                        </span>
                        {file && (
                          <span className="font-medium text-teal-700">Selected: {file.name}</span>
                        )}
                      </label>
                      {sheets.length > 1 && (
                        <label className="text-sm">
                          Choose the sheet to import
                          <select
                            aria-label="Worksheet"
                            className={selectStyle}
                            value={sheet}
                            onChange={(e) => setSheet(e.target.value)}
                          >
                            {sheets.map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                        </label>
                      )}
                    </>
                  ) : (
                    <>
                      <EntryFields
                        definition={definition}
                        values={input}
                        onChange={setInput}
                        courses={courses}
                        categories={categories}
                      />
                      {entity === "colleges" && photoInput(input, setInput)}
                    </>
                  )}
                  <label className="grid gap-1 text-sm">
                    Data source *
                    <TextInput
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                      placeholder="e.g. MCC UG counselling 2026"
                    />
                    <span className="text-xs text-muted">
                      Name the official notice, website or college prospectus used.
                    </span>
                  </label>
                  <details className="text-sm">
                    <summary className="cursor-pointer text-muted">
                      Add source link (optional)
                    </summary>
                    <label className="mt-3 grid gap-1">
                      Official source URL
                      <TextInput
                        value={sourceUrl}
                        onChange={(e) => setSourceUrl(e.target.value)}
                        placeholder="https://official-authority.example/notice.pdf"
                      />
                    </label>
                  </details>
                  <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
                    <Btn
                      disabled={source.trim().length < 2 || (mode === "file" && !file)}
                      onClick={() => void run(create)}
                    >
                      {busy ? "Checking…" : "Check & preview"}
                    </Btn>
                    <p className="text-xs text-muted">
                      Saves a private entry. Nothing is published yet.
                    </p>
                  </div>
                </fieldset>
              </Panel>
              {entity !== "courses" && (
                <details
                  className="rounded-xl border border-line bg-card p-4"
                  onToggle={(e) => {
                    if (e.currentTarget.open && !directory.colleges.length)
                      void run(async () => setDirectory(await get("/colleges")));
                  }}
                >
                  <summary className="cursor-pointer text-sm font-medium">
                    Find a college code
                  </summary>
                  <p className="mt-2 text-xs text-muted">
                    Use the same code in every sheet for this college.
                  </p>
                  <div className="my-3 flex gap-2">
                    <TextInput
                      aria-label="Find college code"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search college, city or code"
                    />
                    <Btn
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        void run(async () =>
                          setDirectory(await get(`/colleges?search=${encodeURIComponent(search)}`)),
                        )
                      }
                    >
                      Search
                    </Btn>
                  </div>
                  <datalist id="entry-college-codes">
                    {directory.colleges.map((c) => (
                      <option key={c._id} value={c.importCode}>
                        {c.name}, {c.city}
                      </option>
                    ))}
                  </datalist>
                  <div className="max-h-64 overflow-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr>
                          <th className="p-2">College</th>
                          <th className="p-2">Code</th>
                          {mode === "manual" && <th />}
                        </tr>
                      </thead>
                      <tbody>
                        {directory.colleges.map((c) => (
                          <tr key={c._id} className="border-t border-line">
                            <td className="p-2">
                              {c.name}
                              <span className="block text-xs text-muted">{c.city}</span>
                            </td>
                            <td className="select-all p-2 font-mono text-xs">{c.importCode}</td>
                            {mode === "manual" && (
                              <td>
                                <Btn
                                  size="sm"
                                  variant="ghost"
                                  disabled={busy}
                                  onClick={() => setInput({ ...input, collegeCode: c.importCode })}
                                >
                                  Use code
                                </Btn>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!directory.colleges.length && (
                      <p className="p-3 text-sm text-muted">
                        No colleges found. Add a college first if it is not in the catalog.
                      </p>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Btn
                      size="sm"
                      variant="ghost"
                      disabled={busy || directory.page <= 1}
                      onClick={() =>
                        void run(async () =>
                          setDirectory(
                            await get(
                              `/colleges?page=${directory.page - 1}&search=${encodeURIComponent(search)}`,
                            ),
                          ),
                        )
                      }
                    >
                      Previous
                    </Btn>
                    <span className="text-xs">
                      Page {directory.page} · {directory.total} colleges
                    </span>
                    <Btn
                      size="sm"
                      variant="ghost"
                      disabled={busy || directory.page * 100 >= directory.total}
                      onClick={() =>
                        void run(async () =>
                          setDirectory(
                            await get(
                              `/colleges?page=${directory.page + 1}&search=${encodeURIComponent(search)}`,
                            ),
                          ),
                        )
                      }
                    >
                      Next
                    </Btn>
                    <Btn
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        downloadCsv("college-codes.csv", [
                          ["collegeCode", "collegeName", "city"],
                          ...directory.colleges.map((c) => [c.importCode, c.name, c.city]),
                        ])
                      }
                    >
                      Download codes on this page
                    </Btn>
                  </div>
                </details>
              )}
            </>
          )}
          {!detail && workspace !== "entry" && (
            <Panel className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl">
                    {workspace === "review" ? "Waiting for your approval" : "Entry history"}
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    {workspace === "review"
                      ? "Open an entry, check the changes and publish or return it."
                      : "Find saved entries and track their progress."}
                  </p>
                </div>
                <Btn
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void run(() => refreshList())}
                >
                  Refresh
                </Btn>
              </div>
              {workspace === "history" && (
                <label className="mt-4 block max-w-xs text-sm">
                  Status
                  <select
                    aria-label="Entry status"
                    className={selectStyle}
                    value={status}
                    disabled={busy}
                    onChange={(e) => {
                      setStatus(e.target.value);
                      void run(() => refreshList(1, e.target.value));
                    }}
                  >
                    <option value="">All entries</option>
                    {Object.entries(statusLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="mt-5 grid gap-3">
                {list.batches.map((b) => (
                  <div
                    key={b._id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="break-words font-semibold">
                        {b.filename === "Manual entry"
                          ? `${entryLabel(b.entity)} · Form entry`
                          : b.filename}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {entryLabel(b.entity)} · {b.totals["total"] || 0} rows · {b.source} ·{" "}
                        {new Date(b.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Pill tone={b.status === "published" ? "teal" : "gray"}>
                      {statusLabels[b.status] || b.status}
                    </Pill>
                    <Btn
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await open(b._id);
                        })
                      }
                    >
                      Open entry
                    </Btn>
                  </div>
                ))}
              </div>
              {!list.batches.length && (
                <div className="py-12 text-center">
                  <CheckCircle2 className="mx-auto mb-3 size-8 text-teal-600" />
                  <p className="text-sm text-muted">
                    {workspace === "review"
                      ? "No entries are waiting for approval."
                      : "No entries found. Start with the Data entry tab."}
                  </p>
                </div>
              )}
              {list.total > 20 && (
                <div className="mt-4 flex items-center gap-3">
                  <Btn
                    size="sm"
                    disabled={busy || list.page <= 1}
                    onClick={() => void run(() => refreshList(list.page - 1))}
                  >
                    Previous entries
                  </Btn>
                  <span className="text-xs">Page {list.page}</span>
                  <Btn
                    size="sm"
                    disabled={busy || list.page * 20 >= list.total}
                    onClick={() => void run(() => refreshList(list.page + 1))}
                  >
                    Next entries
                  </Btn>
                </div>
              )}
            </Panel>
          )}
          {detail && (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <Btn size="sm" variant="ghost" disabled={busy} onClick={back}>
                  <ArrowLeft className="size-4" />
                  {workspace === "entry" ? "New entry" : "Back to entries"}
                </Btn>
                <Pill tone={detail.batch.status === "published" ? "teal" : "gray"}>
                  {statusLabels[detail.batch.status] || detail.batch.status}
                </Pill>
              </div>
              <Panel className="p-5 md:p-6">
                <h2 className="text-xl">{entryLabel(detail.batch.entity)} preview</h2>
                <p className="mt-1 break-words text-sm text-muted">
                  {detail.batch.filename} · {detail.batch.source}
                </p>
                <ol
                  aria-label="Entry progress"
                  className="my-5 grid grid-cols-3 gap-2 text-xs sm:text-sm"
                >
                  {["1. Add data", "2. Check & send", "3. Admin approval"].map((step, index) => (
                    <li
                      key={step}
                      className={cn(
                        "rounded-lg p-3",
                        index === (["submitted", "published"].includes(detail.batch.status) ? 2 : 1)
                          ? "bg-teal-050 font-semibold text-teal-800"
                          : "bg-paper text-muted",
                      )}
                    >
                      {step}
                    </li>
                  ))}
                </ol>
                {detail.batch.reviewNote && (
                  <p className="mb-4 rounded-xl bg-amber-50 p-4 text-sm">
                    Admin note: {detail.batch.reviewNote}
                  </p>
                )}
                <fieldset disabled={busy} className="grid gap-4">
                  <div className="flex flex-wrap gap-4 rounded-xl bg-paper p-4 text-sm">
                    <span>
                      <strong>{detail.batch.totals["total"] || 0}</strong> rows
                    </span>
                    <span>
                      <strong>{detail.batch.totals["valid"] || 0}</strong> checked
                    </span>
                    <span className={detail.batch.totals["errors"] ? "text-rose" : ""}>
                      <strong>{detail.batch.totals["errors"] || 0}</strong> need changes
                    </span>
                  </div>
                  {editable && (
                    <>
                      <details className="rounded-xl border border-line p-4">
                        <summary className="cursor-pointer text-sm font-medium">
                          Data source
                        </summary>
                        <div className="mt-3 grid gap-3">
                          <label className="text-sm">
                            Data source
                            <TextInput
                              value={batchSource}
                              onChange={(e) => setBatchSource(e.target.value)}
                              placeholder="e.g. MCC UG counselling 2026"
                            />
                          </label>
                          <label className="text-sm">
                            Official source URL
                            <TextInput
                              value={batchSourceUrl}
                              onChange={(e) => setBatchSourceUrl(e.target.value)}
                              placeholder="https://official-authority.example/notice.pdf"
                            />
                          </label>
                        </div>
                      </details>
                      <details
                        key={detail.batch._id}
                        open={missingMappings > 0 && detail.batch.filename !== "Manual entry"}
                        className="rounded-xl border border-line p-4"
                      >
                        <summary className="cursor-pointer text-sm font-medium">
                          {missingMappings
                            ? "Match your spreadsheet columns"
                            : "Column settings (only for a different sheet format)"}
                        </summary>
                        <p className="mt-3 text-xs text-muted">
                          Choose the heading for each field. A default fills only blank cells. Our
                          sample sheet is matched automatically.
                        </p>
                        <select
                          aria-label="Saved mapping"
                          className={`${selectStyle} max-w-xs`}
                          defaultValue=""
                          onChange={(e) => {
                            const p = presets.find((p) => p._id === e.target.value);
                            if (p) {
                              setMapping(
                                Object.fromEntries(
                                  Object.entries(p.mapping).filter(([, v]) =>
                                    detail.batch.headers.includes(v),
                                  ),
                                ),
                              );
                              setDefaults(p.defaults);
                            }
                          }}
                        >
                          <option value="">Use saved column settings</option>
                          {presets
                            .filter((p) => p.entity === detail.batch.entity)
                            .map((p) => (
                              <option key={p._id} value={p._id}>
                                {p.name}
                              </option>
                            ))}
                        </select>
                        <div className="mt-3 max-h-80 overflow-auto">
                          <table className="w-full min-w-[500px] text-left text-sm">
                            <thead>
                              <tr>
                                <th>Field</th>
                                <th>Excel heading</th>
                                <th>Default (optional)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {current?.fields.map((f) => (
                                <tr key={f.key}>
                                  <td className="p-2">
                                    {fieldLabel(f.key)}
                                    {f.required ? " *" : ""}
                                  </td>
                                  <td className="p-1">
                                    <select
                                      aria-label={`Map ${f.key}`}
                                      className={selectStyle}
                                      value={mapping[f.key] || ""}
                                      onChange={(e) =>
                                        setMapping({ ...mapping, [f.key]: e.target.value })
                                      }
                                    >
                                      <option value="">Not in this sheet</option>
                                      {detail.batch.headers.map((h) => (
                                        <option key={h}>{h}</option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="p-1">
                                    <TextInput
                                      aria-label={`Default ${f.key}`}
                                      value={defaults[f.key] || ""}
                                      placeholder={f.example}
                                      onChange={(e) =>
                                        setDefaults({ ...defaults, [f.key]: e.target.value })
                                      }
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <TextInput
                            value={presetName}
                            onChange={(e) => setPresetName(e.target.value)}
                            placeholder="Name these settings"
                          />
                          <Btn
                            variant="ghost"
                            size="sm"
                            disabled={!presetName.trim()}
                            onClick={() =>
                              void run(async () => {
                                await post("/presets", {
                                  name: presetName,
                                  entity: detail.batch.entity,
                                  mapping,
                                  defaults,
                                });
                                setPresets(await get("/presets"));
                                setMessage("Column settings saved for your next upload.");
                              })
                            }
                          >
                            Save column settings
                          </Btn>
                        </div>
                      </details>
                    </>
                  )}
                  <p className="text-xs text-muted">
                    Open a row to see its values
                    {editable ? " or make a correction" : " and compare changes"}.{" "}
                    {editable && "Save changes before sending for approval."}
                  </p>
                  {detail.rows.map((row) => (
                    <details
                      key={`${detail.batch._id}-${row.row}`}
                      className={cn(
                        "rounded-xl border p-4",
                        row.errors.length ? "border-rose bg-rose/5" : "border-line",
                      )}
                    >
                      <summary className="cursor-pointer text-sm font-semibold">
                        Row {row.row} ·{" "}
                        {rowValues(row)["name"] ||
                          rowValues(row)["collegeName"] ||
                          rowValues(row)["collegeCode"] ||
                          rowValues(row)["courseSlug"] ||
                          entryLabel(detail.batch.entity)}{" "}
                        <span
                          className={cn(
                            "ml-2 text-xs font-normal",
                            row.errors.length ? "text-rose" : "text-muted",
                          )}
                        >
                          {row.errors.length
                            ? `${row.errors.length} issue(s)`
                            : row.prepared
                              ? {
                                  create: "New record",
                                  update: "Updated record",
                                  unchanged: "No change",
                                }[row.prepared.action] || "Checked"
                              : "Not checked"}
                        </span>
                      </summary>
                      {row.errors.length > 0 && (
                        <ul className="my-3 list-inside list-disc text-sm text-rose">
                          {row.errors.map((error, i) => (
                            <li key={i}>{error}</li>
                          ))}
                        </ul>
                      )}
                      <div className="mt-4">
                        {editable && current ? (
                          <>
                            <EntryFields
                              definition={current}
                              values={rowValues(row)}
                              onChange={(v) => correctRow(row, v)}
                              courses={courses}
                              categories={categories}
                            />
                            {detail.batch.entity === "colleges" && (
                              <div className="mt-4">
                                {photoInput(rowValues(row), (v) => correctRow(row, v))}
                              </div>
                            )}
                          </>
                        ) : (
                          <dl className="grid gap-3 sm:grid-cols-2">
                            {Object.entries(row.mapped || row.input)
                              .filter(([, v]) => v !== "")
                              .map(([key, value]) => (
                                <div key={key}>
                                  <dt className="text-xs text-muted">{fieldLabel(key)}</dt>
                                  <dd className="break-words text-sm">{show(value, key)}</dd>
                                </div>
                              ))}
                          </dl>
                        )}
                      </div>
                      {row.prepared && (
                        <details className="mt-4 rounded-lg bg-paper p-3">
                          <summary className="cursor-pointer text-xs font-medium">
                            View changes before publishing
                          </summary>
                          <div className="mt-3 overflow-auto">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr>
                                  <th>Field</th>
                                  <th>Previous value</th>
                                  <th>New value</th>
                                </tr>
                              </thead>
                              <tbody>
                                {row.prepared.changedFields.map((key) => (
                                  <tr key={key}>
                                    <td className="py-2 pr-3">{fieldLabel(key)}</td>
                                    <td className="max-w-56 break-words pr-3">
                                      {show(
                                        key === "hostelMess"
                                          ? row.prepared?.hostel?.before?.amount
                                          : row.prepared?.before?.[key],
                                        key,
                                      )}
                                    </td>
                                    <td className="max-w-56 break-words">
                                      {show(
                                        key === "hostelMess"
                                          ? row.prepared?.hostel?.document.amount
                                          : row.prepared?.document[key],
                                        key,
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {row.prepared.alias && (
                            <p className="mt-2 text-xs">
                              The source name “{row.prepared.alias.label}” will also identify this
                              college after approval.
                            </p>
                          )}
                        </details>
                      )}
                    </details>
                  ))}
                  {(detail.batch.totals["total"] || 0) > 25 && (
                    <div className="flex items-center gap-3">
                      <Btn
                        size="sm"
                        variant="ghost"
                        disabled={detail.page <= 1 || changed}
                        onClick={() =>
                          void run(async () => {
                            await open(detail.batch._id, detail.page - 1);
                          })
                        }
                      >
                        Previous rows
                      </Btn>
                      <span className="text-xs">Page {detail.page} · 25 rows per page</span>
                      <Btn
                        size="sm"
                        variant="ghost"
                        disabled={
                          detail.page * 25 >= (detail.batch.totals["total"] || 0) || changed
                        }
                        onClick={() =>
                          void run(async () => {
                            await open(detail.batch._id, detail.page + 1);
                          })
                        }
                      >
                        Next rows
                      </Btn>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
                    {editable && (changed || detail.batch.status !== "ready") && (
                      <Btn onClick={() => void run(validate)}>
                        {busy ? "Checking…" : "Save & check again"}
                      </Btn>
                    )}
                    {detail.batch.status === "ready" && (
                      <Btn disabled={changed} onClick={() => void run(() => action("submit"))}>
                        Send for approval
                      </Btn>
                    )}
                    {changed && (
                      <span className="text-xs text-muted">
                        Save your changes to update the preview.
                      </span>
                    )}
                    {detail.batch.status === "submitted" && workspace !== "review" && (
                      <p className="text-sm text-muted">
                        {review
                          ? "Open Review & publish to approve this entry."
                          : "Sent to the main admin. Check Entry history for updates."}
                      </p>
                    )}
                    {detail.batch.status === "published" && (
                      <p className="flex items-center gap-2 text-sm text-teal-700">
                        <CheckCircle2 className="size-4" /> Published on the website
                      </p>
                    )}
                  </div>
                  {review && workspace === "review" && detail.batch.status === "submitted" && (
                    <div className="grid gap-3 rounded-xl border border-teal-200 bg-teal-050 p-4">
                      <p className="text-sm">
                        Check the source, year and row changes. Publishing makes all{" "}
                        {detail.batch.totals["total"] || 0} rows available on the website.
                      </p>
                      <Btn onClick={() => void run(() => action("publish"))}>Approve & publish</Btn>
                      <details className="text-sm">
                        <summary className="cursor-pointer font-medium">
                          Something needs changing?
                        </summary>
                        <div className="mt-3 grid gap-3">
                          <TextInput
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Tell the data-entry person what to fix"
                          />
                          <Btn
                            variant="ghost"
                            disabled={note.trim().length < 3}
                            onClick={() => void run(() => action("reject"))}
                          >
                            Return for changes
                          </Btn>
                        </div>
                      </details>
                    </div>
                  )}
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted">
                      Source file & error report
                    </summary>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {detail.batch.fileId && (
                        <Btn
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            void run(async () => download(await get(`/${detail.batch._id}/file`)))
                          }
                        >
                          Download original
                        </Btn>
                      )}
                      {detail.batch.sourceUrl && (
                        <a
                          className="p-2 text-teal-700 underline"
                          href={detail.batch.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open source notice
                        </a>
                      )}
                      <Btn
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void run(async () => {
                            const errors = await get<ImportRow[]>(`/${detail.batch._id}/errors`);
                            downloadCsv("entry-errors.csv", [
                              ["row", "errors"],
                              ...errors.map((r) => [String(r.row), r.errors.join("; ")]),
                            ]);
                          })
                        }
                      >
                        Download error report
                      </Btn>
                    </div>
                  </details>
                </fieldset>
              </Panel>
            </>
          )}
        </>
      )}
    </div>
  );
}
