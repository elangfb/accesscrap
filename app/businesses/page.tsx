"use client";

import { useMemo, useState } from "react";
import { useBusinesses } from "@/lib/useBusinesses";
import { useBusinessActions, deleteMany } from "@/lib/business";
import {
  STATUS_META,
  STATUS_ORDER,
  type Business,
  type ContactStatus,
} from "@/lib/types";
import { Guard } from "@/components/Guard";
import { BusinessDetail } from "@/components/BusinessDetail";
import { StatusSelect } from "@/components/StatusSelect";
import { waLink } from "@/lib/wa";

const PAGE_SIZE = 50;

export default function BusinessesPage() {
  return (
    <Guard>
      <List />
    </Guard>
  );
}

function List() {
  const { items, loading, error } = useBusinesses();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ContactStatus | "all">("all");
  const [provinsi, setProvinsi] = useState<string>("all");
  const [kategori, setKategori] = useState<string>("all");
  const [contact, setContact] = useState<
    "all" | "has_wa" | "wa_email" | "wa_only" | "email_only"
  >("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Business | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMsg, setBulkMsg] = useState("");
  const [bulkError, setBulkError] = useState("");

  const noPhoneCount = useMemo(
    () => items.filter((b) => !b.telepon || b.telepon.trim() === "").length,
    [items]
  );

  const provinces = useMemo(
    () => Array.from(new Set(items.map((b) => b.provinsi))).sort(),
    [items]
  );
  const categories = useMemo(
    () => Array.from(new Set(items.map((b) => b.kategori))).sort(),
    [items]
  );

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return items.filter((b) => {
      if (status !== "all" && b.status !== status) return false;
      if (provinsi !== "all" && b.provinsi !== provinsi) return false;
      if (kategori !== "all" && b.kategori !== kategori) return false;
      if (contact !== "all") {
        const hasWa = waLink(b.telepon) !== "";
        const hasEmail = b.email.trim() !== "";
        if (contact === "has_wa" && !hasWa) return false;
        if (contact === "wa_email" && !(hasWa && hasEmail)) return false;
        if (contact === "wa_only" && !(hasWa && !hasEmail)) return false;
        if (contact === "email_only" && !(hasEmail && !hasWa)) return false;
      }
      if (s) {
        const hay = (
          b.nama +
          " " +
          b.alamat +
          " " +
          b.telepon +
          " " +
          b.email
        ).toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [items, search, status, provinsi, kategori, contact]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(
    current * PAGE_SIZE,
    current * PAGE_SIZE + PAGE_SIZE
  );

  function resetPage() {
    setPage(0);
  }

  async function deleteWithoutPhone() {
    const targets = items.filter(
      (b) => !b.telepon || b.telepon.trim() === ""
    );
    if (targets.length === 0) {
      setBulkError("");
      setBulkMsg("No businesses without a phone number found.");
      return;
    }
    if (
      !confirm(
        `Delete ${targets.length} business(es) that have no phone number? This cannot be undone.`
      )
    )
      return;
    setBulkBusy(true);
    setBulkError("");
    setBulkMsg(`Deleting ${targets.length}…`);
    try {
      await deleteMany(
        targets.map((b) => b.id),
        (done, total) =>
          setBulkMsg(`Deleting… ${done}/${total}`)
      );
      setBulkMsg(`Deleted ${targets.length} business(es) without a phone number.`);
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : String(err));
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Businesses</h1>
          <p className="mt-1 text-sm text-slate-500">
            {loading
              ? "Loading…"
              : `${filtered.length.toLocaleString()} of ${items.length.toLocaleString()} businesses`}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={deleteWithoutPhone}
            disabled={bulkBusy || loading || noPhoneCount === 0}
            className="rounded-md border border-rose-200 bg-white px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
          >
            {bulkBusy
              ? "Deleting…"
              : `Delete ${noPhoneCount} without phone`}
          </button>
          {bulkMsg && (
            <p className="text-xs text-slate-500">{bulkMsg}</p>
          )}
          {bulkError && (
            <p className="text-xs text-rose-600">{bulkError}</p>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <input
          placeholder="Search name, address, phone…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            resetPage();
          }}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as ContactStatus | "all");
            resetPage();
          }}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        >
          <option value="all">All statuses</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s].label}
            </option>
          ))}
        </select>
        <select
          value={provinsi}
          onChange={(e) => {
            setProvinsi(e.target.value);
            resetPage();
          }}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        >
          <option value="all">All provinces</option>
          {provinces.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          value={kategori}
          onChange={(e) => {
            setKategori(e.target.value);
            resetPage();
          }}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={contact}
          onChange={(e) => {
            setContact(e.target.value as typeof contact);
            resetPage();
          }}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        >
          <option value="all">All contacts</option>
          <option value="has_wa">Has WhatsApp</option>
          <option value="wa_email">WhatsApp + Email</option>
          <option value="wa_only">WhatsApp only</option>
          <option value="email_only">Email only</option>
        </select>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Business</th>
              <th className="px-4 py-3">Province</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && pageItems.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  No businesses match your filters.
                </td>
              </tr>
            )}
            {pageItems.map((b) => (
              <tr
                key={b.id}
                onClick={() => setSelected(b)}
                className="cursor-pointer hover:bg-slate-50"
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">{b.nama}</div>
                  <div className="text-xs text-slate-500">{b.kategori}</div>
                </td>
                <td className="px-4 py-3 text-slate-600">{b.provinsi}</td>
                <td className="px-4 py-3 text-slate-600">
                  {waLink(b.telepon) ? (
                    <a
                      href={waLink(b.telepon)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 font-medium text-emerald-600 hover:underline"
                    >
                      <span aria-hidden>💬</span>
                      {b.telepon}
                    </a>
                  ) : (
                    <div>{b.telepon || "—"}</div>
                  )}
                  {b.email && (
                    <div className="text-xs text-blue-600">{b.email}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusSelect business={b} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Page {current + 1} of {pageCount}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={current === 0}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Prev
            </button>
            <button
              onClick={() =>
                setPage((p) => Math.min(pageCount - 1, p + 1))
              }
              disabled={current >= pageCount - 1}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {selected && (
        <BusinessDetail
          business={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
