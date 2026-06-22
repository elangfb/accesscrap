"use client";

import { useEffect, useRef, useState } from "react";
import { useBusinessActions } from "@/lib/business";
import {
  STATUS_META,
  STATUS_ORDER,
  type Business,
  type ContactStatus,
} from "@/lib/types";

// Inline status picker for the table. Click the badge to open a dropdown of
// every status and pick one — the change is written to Firestore directly,
// without opening the detail modal. Uses a fixed-positioned menu so it isn't
// clipped by the table's `overflow-hidden` wrapper.
export function StatusSelect({ business }: { business: Business }) {
  const { setStatus } = useBusinessActions();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatusState] = useState<ContactStatus>(business.status);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null
  );
  const btnRef = useRef<HTMLButtonElement>(null);

  // Keep the local badge in sync if the snapshot updates the row.
  useEffect(() => {
    setStatusState(business.status);
  }, [business.status]);

  useEffect(() => {
    if (!open) return;
    function close() {
      setOpen(false);
    }
    function onDocMouseDown(e: MouseEvent) {
      if (btnRef.current && btnRef.current.contains(e.target as Node)) return;
      const menu = document.getElementById(`status-menu-${business.id}`);
      if (menu && menu.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    // The menu is viewport-fixed, so close it rather than chase the page.
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open, business.id]);

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setCoords({ top: r.bottom + 4, left: r.left });
    }
    setOpen((o) => !o);
  }

  async function pick(s: ContactStatus) {
    setOpen(false);
    if (s === status) return;
    const prev = status;
    setBusy(true);
    setStatusState(s); // optimistic
    try {
      await setStatus(business, s);
    } catch {
      setStatusState(prev); // revert on failure
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="inline-block"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        ref={btnRef}
        type="button"
        disabled={busy}
        onClick={toggle}
        className={
          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition hover:brightness-95 disabled:opacity-50 " +
          STATUS_META[status].badge
        }
      >
        {STATUS_META[status].label}
        <span aria-hidden className="text-[0.6rem] leading-none opacity-60">
          ▾
        </span>
      </button>

      {open && coords && (
        <div
          id={`status-menu-${business.id}`}
          style={{ position: "fixed", top: coords.top, left: coords.left }}
          className="z-50 w-48 overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-lg"
        >
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => pick(s)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-slate-50"
            >
              <span
                className={
                  "inline-block h-2.5 w-2.5 shrink-0 rounded-full border " +
                  STATUS_META[s].badge
                }
              />
              <span
                className={
                  s === status
                    ? "font-semibold text-slate-900"
                    : "text-slate-700"
                }
              >
                {STATUS_META[s].label}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
