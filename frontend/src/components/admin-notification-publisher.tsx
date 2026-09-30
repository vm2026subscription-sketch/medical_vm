import { useState } from "react";
import { Download, Paperclip, Send, X } from "lucide-react";
import { toast } from "sonner";
import { apiRequest, apiUpload } from "@/lib/api-client";
import { Btn, Panel, TextInput } from "@/components/kit";

type Attachment = { name: string; url: string; mime?: string; size?: number };

export function AdminNotificationPublisher() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState("general");
  const [scheduledFor, setScheduledFor] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const attachFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const selected = Array.from(files);
    if (attachments.length + selected.length > 5) {
      toast.error("You can attach up to 5 files");
      return;
    }
    setUploading(true);
    try {
      const uploaded: Attachment[] = [];
      for (const file of selected) {
        const form = new FormData();
        form.append("file", file);
        const response = await apiUpload<{ data: Attachment }>("/admin/notifications/attachments", form);
        uploaded.push(response.data);
      }
      setAttachments((current) => [...current, ...uploaded]);
      toast.success(`${uploaded.length} attachment${uploaded.length === 1 ? "" : "s"} added`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not upload attachment");
    } finally {
      setUploading(false);
    }
  };

  const publish = async (event: React.FormEvent) => {
    event.preventDefault();
    setPublishing(true);
    try {
      await apiRequest("/admin/notifications", {
        method: "POST",
        body: {
          title,
          body,
          type,
          attachments,
          ...(scheduledFor ? { scheduledFor: new Date(scheduledFor).toISOString() } : {}),
        },
      });
      setTitle("");
      setBody("");
      setType("general");
      setScheduledFor("");
      setAttachments([]);
      toast.success(scheduledFor ? "Notification scheduled" : "Notification published");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not publish notification");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Panel className="p-5 md:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-050 text-teal-700">
          <Send className="size-5" />
        </span>
        <div>
          <h2 className="text-xl">Publish notification</h2>
          <p className="mt-1 text-sm text-muted">
            Send a counselling update to every logged-in student. Add official PDFs, notices or sheets as downloads.
          </p>
        </div>
      </div>
      <form className="mt-5 grid gap-4" onSubmit={publish}>
        <label className="grid gap-1.5 text-sm font-medium">
          Title
          <TextInput required maxLength={180} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Maharashtra NEET UG Round 1 schedule" />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Message
          <textarea
            required
            maxLength={4000}
            rows={5}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Write the important update and what students should do next."
            className="w-full rounded-xl border border-line bg-card px-3.5 py-3 text-sm text-ink placeholder:text-muted-2 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/25"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium">
            Notification type
            <select value={type} onChange={(event) => setType(event.target.value)} className="h-11 rounded-xl border border-line bg-card px-3 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/25">
              <option value="general">General update</option>
              <option value="deadline">Deadline reminder</option>
              <option value="premium_alert">Premium update</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Publish later (optional)
            <TextInput type="datetime-local" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} />
          </label>
        </div>
        <div>
          <p className="text-sm font-medium">Attachments (optional)</p>
          <p className="mt-1 text-xs text-muted">PDF, DOCX, XLSX, CSV, ZIP or TXT. Maximum 5 files, 12 MB each.</p>
          <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-card px-3 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-050">
            <Paperclip className="size-4" /> {uploading ? "Uploading…" : "Attach files"}
            <input className="sr-only" type="file" multiple disabled={uploading} accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.zip,.txt" onChange={(event) => { void attachFiles(event.target.files); event.currentTarget.value = ""; }} />
          </label>
          {attachments.length > 0 && (
            <ul className="mt-3 grid gap-2">
              {attachments.map((file) => (
                <li key={file.url} className="flex items-center justify-between gap-3 rounded-xl bg-paper px-3 py-2 text-sm">
                  <span className="min-w-0 truncate">{file.name}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <a href={file.url} target="_blank" rel="noreferrer" aria-label={`Preview ${file.name}`} className="text-teal-700"><Download className="size-4" /></a>
                    <button type="button" aria-label={`Remove ${file.name}`} onClick={() => setAttachments((current) => current.filter((item) => item.url !== file.url))} className="text-muted hover:text-rose"><X className="size-4" /></button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Btn className="w-full sm:w-fit" disabled={uploading || publishing}>
          <Send className="size-4" /> {publishing ? "Publishing…" : scheduledFor ? "Schedule notification" : "Publish notification"}
        </Btn>
      </form>
    </Panel>
  );
}
