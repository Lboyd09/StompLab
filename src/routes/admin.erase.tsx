import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { adminCloseAccount } from "@/lib/account-delete";
import { isAdminEmail } from "@/lib/plan";
import { usePlan } from "@/lib/use-plan";

export const Route = createFileRoute("/admin/erase")({
  component: ErasePage,
});

function ErasePage() {
  const { user, isPending } = useCurrentUserState();
  const { plan } = usePlan();
  const [email, setEmail] = useState("");
  const [typed, setTyped] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const admin = isAdminEmail(user?.primaryEmail) || plan.admin;

  if (!user && isPending) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!user) return <Navigate to="/login" search={{ next: "/admin/erase" }} />;
  if (!admin) return <Navigate to="/" />;

  const ready =
    confirm === "DELETE" && email.includes("@") && email.trim().toLowerCase() === typed.trim().toLowerCase();

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="space-y-2">
        <Link to="/admin" className="text-xs uppercase tracking-[0.16em] text-muted-foreground underline-offset-2 hover:underline">
          Back to admin
        </Link>
        <h1 className="sl-hero-title text-3xl">Erase a player</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          This deletes that account immediately and cancels their subscription. There is no undo. Type the email
          twice, then DELETE.
        </p>
      </div>
      <form
        className="space-y-3 rounded-2xl border border-destructive/40 bg-card p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!ready) return;
          setNote("");
          setBusy(true);
          void adminCloseAccount({
            data: { email: email.trim(), typedEmail: typed.trim(), confirm: "DELETE" },
          })
            .then((res) => {
              if (!res.ok) {
                setNote(res.error);
                return;
              }
              setNote("That account is erased. They can sign up again.");
              setEmail("");
              setTyped("");
              setConfirm("");
            })
            .catch((err) => setNote(err instanceof Error ? err.message : "Could not delete that account."))
            .finally(() => setBusy(false));
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="erase-email">Player email</Label>
          <Input id="erase-email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="erase-email-2">Type that email again</Label>
          <Input id="erase-email-2" type="email" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="erase-delete">Type DELETE</Label>
          <Input id="erase-delete" autoComplete="off" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <Button type="submit" variant="outline" disabled={busy || !ready}>
          {busy ? "Erasing…" : "Erase this account"}
        </Button>
        {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
      </form>
    </div>
  );
}
