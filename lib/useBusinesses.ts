"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Business } from "@/lib/types";

export function useBusinesses() {
  const [items, setItems] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, "businesses"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: Business[] = snap.docs.map((d) => {
          const data = d.data() as Omit<Business, "id">;
          // email/website were added later; default them so docs imported
          // before this change still satisfy the Business type.
          return { ...data, id: d.id, email: data.email ?? "", website: data.website ?? "" };
        });
        setItems(rows);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  return { items, loading, error };
}
