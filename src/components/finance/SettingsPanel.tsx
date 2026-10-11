import React, { useRef, useState } from "react";
import { Check, Download, LogOut, Moon, Save, Sun, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import type { ApiUser } from "@/types/api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Props {
  darkMode: boolean;
  setDarkMode: (d: boolean) => void;
  currency: string;
  setCurrency: (c: string) => void;
  currencies: string[];
  remainingColor?: string;
  updateRemainingColor: (color: string) => void;
  importFromCsv: (text: string) => void;
  exportToCsv: () => void;
  save: () => Promise<void> | void;
  saveToJson: () => void;
  importFromJson: (file: File) => void;
  loading: boolean;
  username: string | null;
  authEnabled: boolean;
  user: ApiUser | null;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const secondaryButtonClass = "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent";

export default function SettingsPanel({
  darkMode,
  setDarkMode,
  currency,
  setCurrency,
  currencies,
  remainingColor,
  updateRemainingColor,
  importFromCsv,
  exportToCsv,
  save,
  saveToJson,
  importFromJson,
  loading,
  username,
  authEnabled,
  user,
  signOut,
  deleteAccount,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await deleteAccount();
      toast.success("Your account and all data have been deleted.");
    } catch (error) {
      toast.error("Error deleting account: " + (error instanceof Error ? error.message : "Unknown"));
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleTheme = (mode: "light" | "dark") => {
    const isDark = mode === "dark";
    setDarkMode(isDark);
    document.documentElement.classList.toggle("dark", isDark);
    toast.success("Switched to " + mode + " mode!");
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      importFromJson(file);
      event.target.value = "";
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-1">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">App Settings</h2>
        {authEnabled && user && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button type="button" className={secondaryButtonClass}>
                <LogOut size={15} /> Sign out
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Sign out?</AlertDialogTitle>
                <AlertDialogDescription>Are you sure you want to sign out of {username}&apos;s account?</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => void signOut()}>Sign out</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <section className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border/70 bg-card">
        <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm font-medium text-foreground">Appearance</span>
          <div className="grid h-9 grid-cols-2 overflow-hidden rounded-lg border border-border bg-background sm:w-52" role="group" aria-label="Appearance">
            <button
              type="button"
              onClick={() => handleToggleTheme("light")}
              aria-pressed={!darkMode}
              className={`inline-flex items-center justify-center gap-2 px-3 text-sm font-medium transition-colors ${!darkMode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
            ><Sun size={15} /> Light</button>
            <button
              type="button"
              onClick={() => handleToggleTheme("dark")}
              aria-pressed={darkMode}
              className={`inline-flex items-center justify-center gap-2 px-3 text-sm font-medium transition-colors ${darkMode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
            ><Moon size={15} /> Dark</button>
          </div>
        </div>

        <label className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm font-medium text-foreground">Default currency</span>
          <select
            aria-label="Default currency"
            value={currency}
            onChange={(event) => {
              setCurrency(event.target.value);
              toast.success("Currency changed to " + event.target.value);
            }}
            className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/30 sm:w-52"
          >
            {currencies.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>

        <div className="flex items-center justify-between gap-4 px-4 py-3.5">
          <span className="text-sm font-medium text-foreground">Remaining amount color</span>
          <label className="flex h-9 w-12 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border bg-background" title="Choose remaining amount color">
            <input
              type="color"
              aria-label="Remaining amount color"
              value={remainingColor || "#4DB6AC"}
              onChange={(event) => {
                updateRemainingColor(event.target.value);
                toast.success("Remaining value color updated!");
              }}
              className="sr-only"
            />
            <span className="h-5 w-5 rounded-full border border-border/70" style={{ backgroundColor: remainingColor || "#4DB6AC" }} />
          </label>
        </div>

        <div className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Save data</p>
            {authEnabled && username && <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground"><Check size={13} className="text-emerald-500" /> Synced to {username}</p>}
          </div>
          <button
            type="button"
            onClick={() => void save()}
            disabled={loading}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          ><Save size={15} /> {loading ? "Saving…" : "Save data"}</button>
        </div>

        <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm font-medium text-foreground">JSON backup</span>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={saveToJson} className={secondaryButtonClass}><Download size={15} /> Export</button>
            <button type="button" onClick={() => fileInputRef.current?.click()} className={secondaryButtonClass}><Upload size={15} /> Import</button>
          </div>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileImport} className="hidden" />
        </div>

        <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm font-medium text-foreground">CSV backup</span>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={exportToCsv} className={secondaryButtonClass}><Download size={15} /> Export</button>
            <button type="button" onClick={() => csvInputRef.current?.click()} className={secondaryButtonClass}><Upload size={15} /> Import</button>
          </div>
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (result) => {
                const text = result.target?.result;
                if (typeof text === "string") importFromCsv(text);
                event.target.value = "";
              };
              reader.readAsText(file);
            }}
            className="hidden"
          />
        </div>
      </section>

      {authEnabled && user && (
        <section className="flex flex-col gap-3 rounded-xl border border-destructive/25 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Trash2 size={17} className="mt-0.5 shrink-0 text-destructive" />
            <div>
              <h3 className="text-sm font-medium text-foreground">Delete account</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">Permanently delete your account and saved budget data.</p>
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button type="button" disabled={deleting} className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-destructive px-3 text-sm font-medium text-destructive-foreground transition-opacity hover:opacity-90 disabled:opacity-50">
                <Trash2 size={15} /> Delete account
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete account?</AlertDialogTitle>
                <AlertDialogDescription>This permanently deletes your account and all saved budget data. This action cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => void handleDeleteAccount()} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  {deleting ? "Deleting…" : "Delete account"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </section>
      )}
    </div>
  );
}
