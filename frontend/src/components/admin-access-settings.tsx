import { useEffect, useState } from "react";
import { Btn, Panel, TextInput } from "./kit";
import { apiRequest } from "@/lib/api-client";
import { useApp } from "@/lib/app-state";

interface Member {
  _id: string;
  userId: { _id: string; name?: string; email?: string; phone?: string; isActive: boolean } | null;
  roleId: { name: string } | null;
}

export function AdminAccessSettings({ onChanged }: { onChanged?: () => void }) {
  const { user } = useApp();
  const [identifier, setIdentifier] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const refresh = async () => {
    setLoading(true);
    try {
      setMembers((await apiRequest<{ data: Member[] }>("/admin/admin-access")).data);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void refresh().catch((e: Error) => setError(e.message));
  }, []);
  const change = async (member?: Member) => {
    const target = member?.userId;
    if (
      !window.confirm(
        target
          ? `Remove admin access for ${target.email || target.phone || target.name}? Their user account and saved data will remain.`
          : `Give full administrator access to ${identifier.trim()}? They will be able to manage data, payments, users and other admins.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await apiRequest(`/admin/admin-access${target ? `/${target._id}` : ""}`, {
        method: target ? "DELETE" : "POST",
        ...(!target ? { body: { identifier } } : {}),
      });
      setIdentifier("");
      setMessage(
        target
          ? "Admin access removed. The user account and saved data are preserved."
          : "Admin access granted. The user can refresh the website to see their Admin tab.",
      );
      onChanged?.();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update admin access");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel className="mb-5 min-w-0 p-4 sm:p-6">
      <h2 className="text-xl">Admin access</h2>
      <p className="mt-2 text-sm text-muted">
        Make an existing registered user a full admin, or remove their admin access. Use their
        registered email or phone number with country code.
      </p>
      <form
        className="mt-4 flex flex-col gap-3 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void change();
        }}
      >
        <TextInput
          className="min-w-0 sm:flex-1"
          required
          maxLength={254}
          aria-label="Admin user email or phone"
          placeholder="admin@example.com or +919876543210"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          disabled={busy}
        />
        <Btn type="submit" disabled={busy || !identifier.trim()}>
          Make admin
        </Btn>
      </form>
      {error && (
        <p role="alert" className="mt-3 break-words text-sm text-rose">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mt-3 text-sm text-teal-700">
          {message}
        </p>
      )}
      <div className="mt-4 flex items-center justify-between gap-3">
        <h3 className="font-semibold">Current admin access</h3>
        <Btn
          variant="ghost"
          size="sm"
          disabled={busy || loading}
          onClick={() => {
            setError("");
            void refresh().catch((e: Error) => setError(e.message));
          }}
        >
          Refresh admins
        </Btn>
      </div>
      {loading ? (
        <p className="mt-3 text-sm text-muted">Loading admins...</p>
      ) : members.length === 0 && !error ? (
        <p className="mt-3 text-sm text-muted">No admin accounts found.</p>
      ) : null}
      <ul className="mt-3 grid gap-2">
        {members.map((member) => {
          const self = member.userId?._id === user?.id;
          return (
            <li
              key={member._id}
              className="flex min-w-0 flex-col items-start justify-between gap-3 border-t border-line py-3 text-sm sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1 break-words">
                <p className="font-semibold">
                  {member.userId?.name || "Registered user"}
                  {self ? " (You)" : ""}
                </p>
                <p>{member.userId?.email || member.userId?.phone || "User unavailable"}</p>
                <p className="text-xs text-muted">
                  {member.roleId?.name === "super_admin"
                    ? "Full admin"
                    : member.roleId?.name.replaceAll("_", " ") || "Role unavailable"}
                  {member.userId?.isActive === false ? " · Account inactive" : ""}
                </p>
              </div>
              {member.userId && (
                <Btn
                  variant="ghost"
                  size="sm"
                  disabled={busy || self}
                  onClick={() => void change(member)}
                >
                  Remove admin access
                </Btn>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-muted">
        You cannot remove your own admin access. For upload-only access, use the Data-entry team
        section in Site settings.
      </p>
    </Panel>
  );
}
