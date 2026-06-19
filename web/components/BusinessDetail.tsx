"use client";

import { useEffect, useState } from "react";
import { useBusinessActions } from "@/lib/business";
import {
  STATUS_META,
  STATUS_ORDER,
  type Business,
  type ContactStatus,
} from "@/lib/types";

export function BusinessDetail({
  business,
  onClose,
}: {
  business: Business;
  onClose: () => void;
}) {
  const { setStatus, updateNotes, deleteBusiness } = useBusinessActions();
  const [notes, setNotes] = useState(business.notes);
  const [noteDraft, setNoteDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Local mirror of mutable fields so the modal reflects changes
  // immediately after a write, without needing to reopen it. The parent
  // passes a snapshot taken when the row was clicked, which otherwise goes
  // stale until the next open.
  const [status, setStatusState] = useState<Business["status"]>(
    business.status
  );
  const [lastContactedAt, setLastContactedAt] = useState<number | null>(
    business.lastContactedAt
  );

  useEffect(() => {
    setNotes(business.notes);
    setStatusState(business.status);
    setLastContactedAt(business.lastContactedAt);
  }, [business]);

  async function changeStatus(s: ContactStatus) {
    setBusy(true);
    setError("");
    try {
      await setStatus(business, s, noteDraft || undefined);
      setStatusState(s);
      if (s !== "not_contacted") setLastContactedAt(Date.now());
      setNoteDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveNotes() {
    setBusy(true);
    setError("");
    try {
      await updateNotes(business, notes);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete "${business.nama}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await deleteBusiness(business);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="mt-10 w-full max-w-2xl rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {business.nama}
            </h2>
            <p className="text-xs text-slate-500">{business.kategori}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-900"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <Field label="Province" value={business.provinsi} />
            <Field label="Phone" value={business.telepon || "—"} />
            <div className="sm:col-span-2">
              <Field label="Address" value={business.alamat || "—"} />
            </div>
            <Field
              label="Status"
              value={STATUS_META[status].label}
            />
            <Field
              label="Last contacted"
              value={
                lastContactedAt
                  ? new Date(lastContactedAt).toLocaleString()
                  : "Never"
              }
            />
            <div className="sm:col-span-2">
              <Field label="Source file" value={business.sourceFile} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Add a note (saved with the next status change)
            </label>
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              placeholder="e.g. Called, no answer — try again next week"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-slate-600">
              Update status
            </label>
            <div className="flex flex-wrap gap-2">
              {STATUS_ORDER.map((s) => (
                <button
                  key={s}
                  disabled={busy}
                  onClick={() => changeStatus(s)}
                  className={
                    "rounded-full border px-3 py-1 text-xs font-medium disabled:opacity-50 " +
                    (status === s
                      ? STATUS_META[s].badge + " ring-2 ring-offset-1 ring-slate-300"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50")
                  }
                >
                  {STATUS_META[s].label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
            <button
              onClick={saveNotes}
              disabled={busy}
              className="mt-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Save notes
            </button>
          </div>

          {error && (
            <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          )}

          <div className="border-t border-slate-200 pt-4">
            <button
              onClick={remove}
              disabled={busy}
              className="text-xs text-rose-600 hover:text-rose-800 disabled:opacity-50"
            >
              Delete this business
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-0.5 text-slate-800">{value}</div>
    </div>
  );
}
