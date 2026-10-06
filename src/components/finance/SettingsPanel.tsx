import React, { useRef, useState } from "react";
import { 
  Sun, Moon, Globe, Shield, Save, 
  Download, Upload, Check, LogOut, Trash2
} from "lucide-react";
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
    } catch (e: any) {
      toast.error("Error deleting account: " + (e.message || "Unknown"));
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleTheme = (mode: "light" | "dark") => {
    const isDark = mode === "dark";
    setDarkMode(isDark);
    document.documentElement.classList.toggle("dark", isDark);
    toast.success(`Switched to ${mode} mode!`);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importFromJson(file);
      e.target.value = "";
    }
  };

  return (
    <div className="max-w-3xl w-full mx-auto space-y-6 p-2 select-none">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-foreground">App Settings</h2>
        {authEnabled && user && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                className="flex items-center justify-center gap-2 py-2 px-3 bg-background text-foreground border border-border rounded-xl text-xs font-semibold hover:bg-accent transition-all shrink-0"
              >
                <LogOut size={14} /> Sign out
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Sign out?</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to sign out of {username}&apos;s account?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => void signOut()}>
                  Sign out
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Preferences */}
        <div className="bg-card border border-border/70 rounded-2xl p-5 space-y-5">
          <div className="flex items-center gap-2 pb-2 border-b border-border/50">
            <Globe className="text-primary shrink-0" size={16} />
            <h3 className="text-sm font-bold text-foreground">Preferences</h3>
          </div>

          {/* Theme Selector */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              Interface Theme
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleToggleTheme("light")}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-xs font-semibold transition-all ${
                  !darkMode
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-background text-muted-foreground hover:text-foreground border-border/80 hover:bg-accent"
                }`}
              >
                <Sun size={15} /> Light Mode
              </button>
              <button
                onClick={() => handleToggleTheme("dark")}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-xs font-semibold transition-all ${
                  darkMode
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-background text-muted-foreground hover:text-foreground border-border/80 hover:bg-accent"
                }`}
              >
                <Moon size={15} /> Dark Mode
              </button>
            </div>
          </div>

          {/* Currency selector */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              Default Currency Symbol
            </label>
            <div className="relative">
              <select
                value={currency}
                onChange={(e) => {
                  setCurrency(e.target.value);
                  toast.success(`Currency changed to ${e.target.value}`);
                }}
                className="w-full bg-background border border-border/80 text-foreground py-2.5 px-3.5 pr-8 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring appearance-none cursor-pointer"
              >
                {currencies.map((c) => (
                  <option key={c} value={c}>
                    {c === currency ? `${c} (Active)` : c}
                  </option>
                ))}
              </select>
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                <Globe size={14} />
              </div>
            </div>
          </div>

          {/* Remaining Color Selector */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              Remaining Money Color
            </label>
            <label className="flex items-center gap-3 bg-background border border-border/80 rounded-xl p-2.5 px-3.5 cursor-pointer hover:bg-accent/40 transition-colors">
              <input
                type="color"
                value={remainingColor || "#4DB6AC"}
                onChange={(e) => {
                  updateRemainingColor(e.target.value);
                  toast.success(`Remaining value color updated!`);
                }}
                className="sr-only"
              />
              <div 
                className="w-7 h-7 rounded-full border border-border/80 shadow-sm flex-shrink-0"
                style={{ backgroundColor: remainingColor || "#4DB6AC" }}
                title="Set remaining color"
              />
              <span className="text-xs text-muted-foreground font-medium select-none">Click circle to choose color</span>
            </label>
          </div>
        </div>

        {/* Card 2: Backup & Operations */}
        <div className="bg-card border border-border/70 rounded-2xl p-5 space-y-5">
          <div className="flex items-center gap-2 pb-2 border-b border-border/50">
            <Shield className="text-primary shrink-0" size={16} />
            <h3 className="text-sm font-bold text-foreground">Data Management</h3>
          </div>

          {/* Sync / Database Save */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              Database Sync
            </label>
            <button
              onClick={save}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-xl text-xs font-semibold hover:opacity-95 transition-all shadow-sm disabled:opacity-50"
            >
              <Save size={15} /> {loading ? "Saving changes..." : "Save Data"}
            </button>
            {authEnabled && username && (
              <p className="text-[10px] text-muted-foreground text-center flex items-center justify-center gap-1">
                <Check size={10} className="text-green-500" /> Synced to account: <span className="font-semibold">{username}</span>
              </p>
            )}
          </div>

          {/* Backup Restores (JSON) */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              JSON File Backup
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={saveToJson}
                className="flex items-center justify-center gap-2 py-2.5 px-3 bg-background text-foreground border border-border rounded-xl text-xs font-semibold hover:bg-accent transition-all"
              >
                <Download size={14} /> Export JSON
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 py-2.5 px-3 bg-background text-foreground border border-border rounded-xl text-xs font-semibold hover:bg-accent transition-all"
              >
                <Upload size={14} /> Import JSON
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileImport}
              className="hidden"
            />
          </div>

          {/* Backup Restores (CSV) */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              CSV File Backup
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={exportToCsv}
                className="flex items-center justify-center gap-2 py-2.5 px-3 bg-background text-foreground border border-border rounded-xl text-xs font-semibold hover:bg-accent transition-all"
              >
                <Download size={14} /> Export CSV
              </button>
              <button
                onClick={() => csvInputRef.current?.click()}
                className="flex items-center justify-center gap-2 py-2.5 px-3 bg-background text-foreground border border-border rounded-xl text-xs font-semibold hover:bg-accent transition-all"
              >
                <Upload size={14} /> Import CSV
              </button>
            </div>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    const text = event.target?.result as string;
                    if (text) {
                      importFromCsv(text);
                    }
                    e.target.value = "";
                  };
                  reader.readAsText(file);
                }
              }}
              className="hidden"
            />
          </div>
        </div>

        {/* Card 3: Danger Zone */}
        {authEnabled && user && (
          <div className="md:col-span-2 bg-destructive/5 border border-destructive/20 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-destructive/10">
              <Trash2 className="text-destructive shrink-0" size={16} />
              <h3 className="text-sm font-bold text-destructive">Danger Zone</h3>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-foreground">Delete Account</h4>
                <p className="text-[11px] text-muted-foreground">
                  Permanently delete your account and all saved budget data. This action cannot be undone.
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    disabled={deleting}
                    className="flex items-center justify-center gap-2 py-2 px-4 bg-destructive text-destructive-foreground rounded-xl text-xs font-semibold hover:bg-destructive/90 transition-all shadow-sm shrink-0"
                  >
                    <Trash2 size={14} /> Delete Account
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Account</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete your account and all your saved budget data. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAccount}
                      disabled={deleting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deleting ? "Deleting..." : "Delete Account"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

