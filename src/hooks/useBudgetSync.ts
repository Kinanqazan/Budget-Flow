import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { ApiBudgetData } from "@/types/api";
import type { FinanceData } from "@/types/finance";

type Draft = { finance_data: FinanceData; dark_mode: boolean; currency: string };
type Options = { userId?: string; enabled: boolean; draft: Draft; apply: (snapshot: ApiBudgetData) => void };
const signature = (value: Pick<ApiBudgetData, "finance_data" | "dark_mode" | "currency">) =>
  JSON.stringify([value.finance_data, value.dark_mode, value.currency]);

/** Owns synchronization, leaving UI editing and export in useFinanceData. */
export function useBudgetSync(options: Options) {
  const current = useRef(options); current.current = options;
  const sequence = useRef(0);
  const epoch = useRef(0);
  const acknowledged = useRef<string | null>(null);
  const revision = useRef<number | null>(null);
  const saving = useRef<Promise<void> | null>(null);
  const reading = useRef(false);
  const paused = useRef(false);
  const [conflict, setConflict] = useState(false);
  const [ready, setReady] = useState(false);
  const [saveVersion, setSaveVersion] = useState(0);
  const markEdited = useCallback(() => { sequence.current++; }, []);
  const dirty = () => signature(current.current.draft) !== acknowledged.current;

  const refresh = useCallback(async (discardDraft = false) => {
    if (!current.current.enabled || !current.current.userId || saving.current || reading.current) return;
    if (!discardDraft && revision.current !== null && (paused.current || dirty())) return;
    const generation = epoch.current;
    const edits = sequence.current;
    const knownRevision = revision.current;
    reading.current = true;
    try {
      const row = await api.budget.get();
      if (!row || generation !== epoch.current || edits !== sequence.current || saving.current || knownRevision !== revision.current) return;
      if (!Number.isSafeInteger(row.revision) || row.revision < 0) throw new Error("Update the app and backend together before saving");
      // Edits made before the first successful read also need explicit resolution.
      if (!discardDraft && knownRevision === null && edits > 0) {
        paused.current = true; setConflict(true); return;
      }
      revision.current = row.revision;
      acknowledged.current = signature(row);
      current.current.apply(row);
      paused.current = false; setConflict(false); setReady(true);
    } finally { if (generation === epoch.current) reading.current = false; }
  }, []);

  useEffect(() => {
    const generation = ++epoch.current;
    sequence.current = 0; revision.current = null; acknowledged.current = null;
    saving.current = null; reading.current = false; paused.current = false;
    setConflict(false); setReady(false);
    if (options.enabled && options.userId) void refresh().catch(() => { /* Keep the local draft; retry on focus/poll. */ });
    return () => { epoch.current = generation + 1; };
  }, [options.enabled, options.userId, refresh]);

  const save = useCallback(async (): Promise<void> => {
    if (!current.current.enabled || !current.current.userId) return;
    if (saving.current) {
      const generation = epoch.current;
      await saving.current;
      if (generation !== epoch.current) return;
      return save();
    }
    if (paused.current) throw new Error("Saving is paused. Export your edits or load the saved budget to continue.");
    if (revision.current === null) throw new Error("Saved budget has not loaded. Reconnect before saving.");
    if (!dirty()) return;
    const generation = epoch.current;
    const expected = revision.current;
    const draft = structuredClone(current.current.draft);
    const pending = (async () => {
      try {
        const row = await api.budget.save(draft.finance_data, draft.dark_mode, draft.currency, expected);
        if (generation !== epoch.current) return;
        if (!Number.isSafeInteger(row.revision) || row.revision !== expected + 1) throw new Error("Save could not be confirmed; reload the saved budget");
        revision.current = row.revision;
        acknowledged.current = signature(draft);
      } catch (error) {
        if (generation === epoch.current) {
          // A lost response can mean the write succeeded: read before another write.
          paused.current = true; setConflict(true);
        }
        throw error;
      } finally {
        if (generation === epoch.current) { saving.current = null; setSaveVersion(value => value + 1); }
      }
    })();
    saving.current = pending;
    await pending;
  }, []);

  useEffect(() => {
    if (!ready || !options.enabled || !options.userId || paused.current || !dirty()) return;
    const timer = setTimeout(() => { void save().catch(() => { /* Local edits remain available. */ }); }, 2000);
    return () => clearTimeout(timer);
  }, [options.draft.finance_data, options.draft.dark_mode, options.draft.currency, options.enabled, options.userId, ready, saveVersion, save]);

  useEffect(() => {
    const update = () => {
      if (document.visibilityState === "visible") void refresh().catch(() => { /* Keep the local draft. */ });
    };
    const timer = setInterval(update, 10000);
    window.addEventListener("focus", update); document.addEventListener("visibilitychange", update);
    return () => { clearInterval(timer); window.removeEventListener("focus", update); document.removeEventListener("visibilitychange", update); };
  }, [refresh]);

  const loadSavedBudget = useCallback(async () => {
    try { await refresh(true); } catch { throw new Error("Could not load the saved budget. Your local edits are kept."); }
  }, [refresh]);
  return { save, refresh, loadSavedBudget, conflict, markEdited };
}
