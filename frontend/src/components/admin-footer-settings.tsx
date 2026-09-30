import { useEffect, useState } from "react";
import { Link2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api-client";
import { Btn, Panel, TextInput } from "@/components/kit";

type ContactType = "phone" | "email" | "whatsapp" | "address";
type LinkIcon = "instagram" | "facebook" | "youtube" | "linkedin" | "x" | "website";
type Contact = { type: ContactType; label: string; value: string; url?: string };
type FooterLink = { icon: LinkIcon; label: string; url: string };
type FooterSettings = { contacts: Contact[]; links: FooterLink[] };
const empty: FooterSettings = { contacts: [], links: [] };

export function AdminFooterSettings() {
  const [settings, setSettings] = useState<FooterSettings>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let current = true;
    apiRequest<{ data: FooterSettings }>("/admin/footer")
      .then((result) => { if (current) setSettings(result.data || empty); })
      .catch((error) => { if (current) toast.error(error instanceof Error ? error.message : "Could not load footer settings"); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await apiRequest("/admin/footer", { method: "PUT", body: settings });
      toast.success("Footer settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save footer settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel className="mt-5 p-5 md:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-050 text-teal-700"><Link2 className="size-5" /></span>
        <div>
          <h2 className="text-xl">Footer contacts & links</h2>
          <p className="mt-1 text-sm text-muted">Only saved items appear on the public footer. You can leave this empty until details are ready.</p>
        </div>
      </div>

      {loading ? <p className="mt-5 text-sm text-muted">Loading footer settings…</p> : <>
        <div className="mt-6">
          <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Contact details</h3><Btn type="button" size="sm" variant="ghost" onClick={() => setSettings((current) => ({ ...current, contacts: [...current.contacts, { type: "email", label: "Email", value: "", url: "" }] }))}><Plus className="size-4" /> Add contact</Btn></div>
          <div className="mt-3 grid gap-3">
            {settings.contacts.map((contact, index) => <div key={`${contact.label}-${index}`} className="grid gap-2 rounded-xl bg-paper p-3 md:grid-cols-[130px_1fr_1fr_auto]">
              <select aria-label="Contact type" value={contact.type} onChange={(event) => setSettings((current) => ({ ...current, contacts: current.contacts.map((item, itemIndex) => itemIndex === index ? { ...item, type: event.target.value as ContactType } : item) }))} className="h-11 rounded-xl border border-line bg-card px-3 text-sm"><option value="phone">Phone</option><option value="email">Email</option><option value="whatsapp">WhatsApp</option><option value="address">Address</option></select>
              <TextInput aria-label="Contact label" placeholder="Label, e.g. Admissions support" value={contact.label} onChange={(event) => setSettings((current) => ({ ...current, contacts: current.contacts.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item) }))} />
              <TextInput aria-label="Contact value" placeholder="Number, email or address" value={contact.value} onChange={(event) => setSettings((current) => ({ ...current, contacts: current.contacts.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item) }))} />
              <button type="button" aria-label={`Remove ${contact.label || "contact"}`} onClick={() => setSettings((current) => ({ ...current, contacts: current.contacts.filter((_, itemIndex) => itemIndex !== index) }))} className="justify-self-end text-muted hover:text-rose"><Trash2 className="size-4" /></button>
            </div>)}
          </div>
        </div>

        <div className="mt-7">
          <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Profile & social links</h3><Btn type="button" size="sm" variant="ghost" onClick={() => setSettings((current) => ({ ...current, links: [...current.links, { icon: "website", label: "Website", url: "" }] }))}><Plus className="size-4" /> Add link</Btn></div>
          <div className="mt-3 grid gap-3">
            {settings.links.map((link, index) => <div key={`${link.label}-${index}`} className="grid gap-2 rounded-xl bg-paper p-3 md:grid-cols-[130px_1fr_1fr_auto]">
              <select aria-label="Link icon" value={link.icon} onChange={(event) => setSettings((current) => ({ ...current, links: current.links.map((item, itemIndex) => itemIndex === index ? { ...item, icon: event.target.value as LinkIcon } : item) }))} className="h-11 rounded-xl border border-line bg-card px-3 text-sm"><option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="youtube">YouTube</option><option value="linkedin">LinkedIn</option><option value="x">X</option><option value="website">Website</option></select>
              <TextInput aria-label="Link label" placeholder="Label" value={link.label} onChange={(event) => setSettings((current) => ({ ...current, links: current.links.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item) }))} />
              <TextInput aria-label="Link URL" type="url" placeholder="https://…" value={link.url} onChange={(event) => setSettings((current) => ({ ...current, links: current.links.map((item, itemIndex) => itemIndex === index ? { ...item, url: event.target.value } : item) }))} />
              <button type="button" aria-label={`Remove ${link.label || "link"}`} onClick={() => setSettings((current) => ({ ...current, links: current.links.filter((_, itemIndex) => itemIndex !== index) }))} className="justify-self-end text-muted hover:text-rose"><Trash2 className="size-4" /></button>
            </div>)}
          </div>
        </div>
        <Btn className="mt-6" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save footer settings"}</Btn>
      </>}
    </Panel>
  );
}
