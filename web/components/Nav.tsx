"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/businesses", label: "Businesses" },
  { href: "/upload", label: "Upload CSV" },
];

export function Nav() {
  const { user, loading, signOutUser } = useAuth();
  const pathname = usePathname();

  if (loading) {
    return (
      <nav className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
          <span className="text-sm text-slate-400">Loading…</span>
        </div>
      </nav>
    );
  }

  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold text-slate-900">
            Contact Tracker
          </Link>
          {user &&
            links.map((l) => {
              const active =
                pathname === l.href ||
                (l.href !== "/" && pathname.startsWith(l.href));
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={
                    "text-sm " +
                    (active
                      ? "text-slate-900 font-medium"
                      : "text-slate-500 hover:text-slate-900")
                  }
                >
                  {l.label}
                </Link>
              );
            })}
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="text-xs text-slate-400">{user.email}</span>
              <button
                onClick={() => signOutUser()}
                className="text-sm text-slate-500 hover:text-slate-900"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="text-sm text-slate-500 hover:text-slate-900"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
