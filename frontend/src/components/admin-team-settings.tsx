import { useEffect, useState } from "react";
import { Btn, Panel, TextInput } from "./kit";
import { apiRequest } from "@/lib/api-client";
interface Member {
  _id: string;
  userId: { _id: string; name?: string; email?: string; phone?: string } | null;
}
export function AdminTeamSettings() {
  const [email, setEmail] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const refresh = async () =>
    setMembers((await apiRequest<{ data: Member[] }>("/admin/data-entry-users")).data);
  useEffect(() => {
    void refresh().catch((e: Error) => setError(e.message));
  }, []);
  const change = async (id?: string) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await apiRequest(`/admin/data-entry-users${id ? `/${id}` : ""}`, {
        method: id ? "DELETE" : "POST",
        ...(!id ? { body: { email } } : {}),
      });
      await refresh();
      setEmail("");
      setMessage(
        id
          ? "Data-entry access removed. Saved batches remain in the review history."
          : "Data-entry access granted. Ask the user to log out and log in again.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update access");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel className="mt-5 p-6">
      <h2 className="text-xl">Data-entry team</h2>
      <p className="mt-2 text-sm text-muted">
        Assign an existing registered user. This role can prepare drafts, upload photos and submit
        data for review. Publishing, payments, subscriptions, user management and site settings
        remain restricted.
      </p>
      <form
        className="mt-4 flex flex-wrap gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void change();
        }}
      >
        <TextInput
          required
          type="email"
          aria-label="Data-entry user email"
          placeholder="data.operator@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
        />
        <Btn type="submit" disabled={busy}>
          Grant data-entry access
        </Btn>
      </form>
      {error && (
        <p role="alert" className="mt-3 text-sm text-rose">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mt-3 text-sm text-teal-700">
          {message}
        </p>
      )}
      <ul className="mt-4 grid gap-2">
        {members.map((m) => (
          <li
            key={m._id}
            className="flex flex-wrap items-center justify-between gap-3 border-t border-line py-3 text-sm"
          >
            <span>
              {m.userId?.name} · {m.userId?.email || m.userId?.phone || "User unavailable"}
            </span>
            {m.userId && (
              <Btn
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => void change(m.userId!._id)}
              >
                Remove data-entry access
              </Btn>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
