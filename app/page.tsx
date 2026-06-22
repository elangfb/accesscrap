"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useBusinesses } from "@/lib/useBusinesses";
import {
  STATUS_META,
  STATUS_ORDER,
  type ContactStatus,
} from "@/lib/types";
import { Guard } from "@/components/Guard";

export default function HomePage() {
  return (
    <Guard>
      <Dashboard />
    </Guard>
  );
}

function Dashboard() {
  const { items, loading, error } = useBusinesses();

  const counts = useMemo(() => {
    const map = {} as Record<ContactStatus, number>;
    for (const s of STATUS_ORDER) map[s] = 0;
    for (const b of items) map[b.status] = (map[b.status] ?? 0) + 1;
    return map;
  }, [items]);

  const total = items.length;
  const cantBeContacted = counts.cant_be_contacted ?? 0;
  // "Contacted" = reached in some way; excludes both not-yet-contacted and
  // those we determined can't be contacted at all.
  const contacted = total - (counts.not_contacted ?? 0) - cantBeContacted;
  // Progress is measured against reachable businesses, so unreachable ones
  // don't permanently cap the percentage below 100%.
  const contactable = total - cantBeContacted;
  const pct = contactable > 0 ? Math.round((contacted / contactable) * 100) : 0;

  const byProvince = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of items) {
      if (b.status === "not_contacted" || b.status === "cant_be_contacted")
        continue;
      map.set(b.provinsi, (map.get(b.provinsi) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [items]);

  if (loading) {
    return <div className="py-20 text-center text-sm text-slate-400">Loading…</div>;
  }

  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Outreach progress across your imported businesses.
          </p>
        </div>
        <Link
          href="/upload"
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          Upload CSV
        </Link>
      </div>

      {error && (
        <p className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      {total === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm text-slate-500">
            No businesses yet. Upload a CSV to get started.
          </p>
          <Link
            href="/upload"
            className="mt-3 inline-block rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
          >
            Upload CSV
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Total businesses" value={total.toLocaleString()} />
            <StatCard label="Contacted" value={contacted.toLocaleString()} />
            <StatCard
              label="Can't be contacted"
              value={cantBeContacted.toLocaleString()}
            />
            <StatCard label="Progress" value={`${pct}%`} />
          </div>

          <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-900">
              Status breakdown
            </h2>
            <div className="mt-4 space-y-3">
              {STATUS_ORDER.map((s) => {
                const c = counts[s] ?? 0;
                const w = total > 0 ? (c / total) * 100 : 0;
                return (
                  <div key={s}>
                    <div className="flex items-center justify-between text-xs">
                      <span className={STATUS_META[s].color}>
                        {STATUS_META[s].label}
                      </span>
                      <span className="text-slate-500">
                        {c.toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={"h-full " + barColor(s)}
                        style={{ width: `${w}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {byProvince.length > 0 && (
            <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-900">
                Contacted by province (top 8)
              </h2>
              <ul className="mt-3 divide-y divide-slate-100 text-sm">
                {byProvince.map(([prov, c]) => (
                  <li
                    key={prov}
                    className="flex items-center justify-between py-2"
                  >
                    <span className="text-slate-700">{prov}</span>
                    <span className="text-slate-500">{c.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6">
            <Link
              href="/businesses"
              className="text-sm font-medium text-slate-900 hover:underline"
            >
              View all businesses →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function barColor(s: ContactStatus): string {
  switch (s) {
    case "not_contacted":
      return "bg-slate-300";
    case "cant_be_contacted":
      return "bg-stone-400";
    case "contacted":
      return "bg-blue-400";
    case "responded":
      return "bg-indigo-400";
    case "not_interested":
      return "bg-rose-400";
    case "follow_up":
      return "bg-amber-400";
    case "converted":
      return "bg-emerald-400";
  }
}
