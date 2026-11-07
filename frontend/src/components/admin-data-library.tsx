import { useMemo, useState } from "react";
import { Database, FileSpreadsheet } from "lucide-react";
import { Btn, Panel, Pill } from "@/components/kit";
import { AdminResourcePanel } from "@/components/admin-resource-panel";
import type { AdminSession, Resource } from "@/lib/admin";

const catalogKeys = [
  "colleges",
  "courses",
  "college-courses",
  "cutoffs",
  "fees",
  "hostel-fees",
  "bonds",
  "seat-matrix",
];

export function AdminDataLibrary({
  resources,
  session,
  onDraft,
}: {
  resources: Resource[];
  session: AdminSession;
  onDraft: (id: string) => void;
}) {
  const catalog = useMemo(() => resources.filter((resource) => catalogKeys.includes(resource.key)), [resources]);
  const [selectedKey, setSelectedKey] = useState(catalog[0]?.key || "");
  const selected = catalog.find((resource) => resource.key === selectedKey) || catalog[0];

  if (!selected) return null;
  return (
    <div className="grid gap-5">
      <Panel className="p-5 md:p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-050 text-teal-700">
            <Database className="size-5" />
          </span>
          <div>
            <h2 className="text-xl">Catalog data library</h2>
            <p className="mt-1 text-sm text-muted">
              Access every published catalog dataset, download its complete Excel file, or open a safe correction draft.
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {catalog.map((resource) => (
            <Btn
              key={resource.key}
              type="button"
              size="sm"
              variant={selected.key === resource.key ? "primary" : "ghost"}
              onClick={() => setSelectedKey(resource.key)}
            >
              {resource.label}
            </Btn>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs text-muted">
          <FileSpreadsheet className="size-4 text-teal-700" />
          <span>Excel files use the same stable college code and course slug format as the import sheets.</span>
          <Pill tone="teal">Live catalog</Pill>
        </div>
      </Panel>
      <AdminResourcePanel resource={selected} session={session} onDraft={onDraft} />
    </div>
  );
}
