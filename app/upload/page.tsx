"use client";

import { useState } from "react";
import {
  collection,
  writeBatch,
  doc,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  parseCsv,
  makeBusiness,
  computeDedupeKey,
  type ParsedBusiness,
} from "@/lib/csv";
import { Guard } from "@/components/Guard";

const BATCH_SIZE = 450;

export default function UploadPage() {
  return (
    <Guard>
      <UploadForm />
    </Guard>
  );
}

function UploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Load every existing business keyed by dedupeKey in one round trip. The web
  // SDK does not support field projection, so full docs are returned; at this
  // app's scale (thousands of businesses) one request is far cheaper than
  // hundreds of `in` queries (capped at 30 values each). We keep the doc id and
  // current email/website so a re-import can backfill those fields.
  async function fetchExisting(): Promise<
    Map<string, { id: string; email: string; website: string }>
  > {
    const snap = await getDocs(collection(db, "businesses"));
    const present = new Map<
      string,
      { id: string; email: string; website: string }
    >();
    snap.forEach((d) => {
      const data = d.data() as {
        dedupeKey?: string;
        email?: string;
        website?: string;
      };
      if (data.dedupeKey) {
        present.set(data.dedupeKey, {
          id: d.id,
          email: data.email ?? "",
          website: data.website ?? "",
        });
      }
    });
    return present;
  }

  async function handleImport() {
    if (!file) return;
    setBusy(true);
    setError("");
    setMessage("");
    setProgress({ done: 0, total: 0 });
    try {
      const rows = await parseCsv(file);
      if (rows.length === 0) {
        setError("No valid rows found. Check the CSV headers match the expected format.");
        setBusy(false);
        return;
      }

      // Build candidate keys, then drop duplicates within the file itself.
      const seenInFile = new Set<string>();
      const candidates: { row: ParsedBusiness; key: string }[] = [];
      let inFileDupes = 0;
      for (const row of rows) {
        const key = computeDedupeKey(row);
        if (seenInFile.has(key)) {
          inFileDupes++;
          continue;
        }
        seenInFile.add(key);
        candidates.push({ row, key });
      }

      // Compare against what's already in Firestore. New keys are inserted;
      // existing keys whose email/website is missing get backfilled from this
      // file (preserving status/notes/etc.); fully-populated rows are skipped.
      const existing = await fetchExisting();
      const col = collection(db, "businesses");

      type Op =
        | { type: "insert"; row: ParsedBusiness }
        | { type: "update"; id: string; data: Record<string, string | number> };
      const ops: Op[] = [];
      let skippedExisting = 0;

      for (const { row, key } of candidates) {
        const ex = existing.get(key);
        if (!ex) {
          ops.push({ type: "insert", row });
          continue;
        }
        const patch: Record<string, string | number> = {};
        if (row.email && !ex.email) patch.email = row.email;
        if (row.website && !ex.website) patch.website = row.website;
        if (Object.keys(patch).length > 0) {
          patch.updatedAt = Date.now();
          ops.push({ type: "update", id: ex.id, data: patch });
        } else {
          skippedExisting++;
        }
      }

      const inserts = ops.filter((o) => o.type === "insert").length;
      const updates = ops.length - inserts;
      const totalSkipped = inFileDupes + skippedExisting;

      if (ops.length === 0) {
        setMessage(
          `Nothing to do. Skipped ${totalSkipped} duplicate(s) in "${file.name}" (already present with contact info).`
        );
        setProgress({ done: 0, total: 0 });
        setFile(null);
        setBusy(false);
        return;
      }

      let done = 0;
      for (let i = 0; i < ops.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const slice = ops.slice(i, i + BATCH_SIZE);
        for (const op of slice) {
          if (op.type === "insert") {
            batch.set(doc(col), makeBusiness(op.row, file.name));
          } else {
            batch.update(doc(col, op.id), op.data);
          }
        }
        await batch.commit();
        done += slice.length;
        setProgress({ done, total: ops.length });
      }
      setMessage(
        `"${file.name}": imported ${inserts} new, backfilled email/website on ${updates} existing.` +
          (totalSkipped > 0
            ? ` Skipped ${totalSkipped} (${inFileDupes} dupes within file, ${skippedExisting} already complete).`
            : "")
      );
      setFile(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  const pct =
    progress && progress.total > 0
      ? Math.round((progress.done / progress.total) * 100)
      : 0;

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-slate-900">Upload CSV</h1>
      <p className="mt-1 text-sm text-slate-500">
        Import a business directory CSV. Expected columns:{" "}
        <code className="rounded bg-slate-100 px-1 text-xs">
          Provinsi, Kategori, Nama Usaha, Alamat Usaha, Nomor Telepon, Email,
          Website
        </code>
        .
      </p>
      <p className="mt-2 text-sm text-slate-500">
        Duplicates are detected by name + address. Re-importing an updated file
        backfills email/website onto existing businesses without touching their
        status or notes.
      </p>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">CSV file</span>
          <input
            type="file"
            accept=".csv"
            disabled={busy}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-2 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700"
          />
        </label>

        {file && (
          <p className="mt-2 text-xs text-slate-500">
            Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
          </p>
        )}

        {progress && progress.total > 0 && (
          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-slate-900 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {progress.done} / {progress.total} ({pct}%)
            </p>
          </div>
        )}

        {message && (
          <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {message}
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}

        <button
          onClick={handleImport}
          disabled={!file || busy}
          className="mt-6 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {busy ? "Importing…" : "Import businesses"}
        </button>
      </div>

      <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <p className="font-medium">Note on large imports</p>
        <p className="mt-1">
          Firestore limits each batch to 500 writes. This importer commits in
          batches of {BATCH_SIZE}. Very large files may take a few minutes —
          keep this tab open until it finishes.
        </p>
      </div>
    </div>
  );
}
