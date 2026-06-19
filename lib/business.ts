"use client";

import { useCallback } from "react";
import {
  collection,
  doc,
  updateDoc,
  deleteDoc,
  writeBatch,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Business, ContactStatus } from "@/lib/types";

export function useBusinessActions() {
  const setStatus = useCallback(
    async (b: Business, status: ContactStatus, note?: string) => {
      const ref = doc(db, "businesses", b.id);
      const now = Date.now();
      const patch: Partial<Business> & { updatedAt: number } = {
        status,
        updatedAt: now,
      };
      if (status !== "not_contacted") patch.lastContactedAt = now;
      if (note !== undefined) patch.notes = note;
      await updateDoc(ref, patch);

      await addDoc(collection(db, "logs"), {
        businessId: b.id,
        status,
        note: note ?? "",
        contactedAt: now,
        createdAt: serverTimestamp(),
      });
    },
    []
  );

  const updateNotes = useCallback(async (b: Business, notes: string) => {
    const ref = doc(db, "businesses", b.id);
    await updateDoc(ref, { notes, updatedAt: Date.now() });
  }, []);

  const deleteBusiness = useCallback(async (b: Business) => {
    await deleteDoc(doc(db, "businesses", b.id));
  }, []);

  return { setStatus, updateNotes, deleteBusiness, deleteMany };
}

const DELETE_BATCH_SIZE = 450;

export async function deleteMany(
  ids: string[],
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  const col = collection(db, "businesses");
  let done = 0;
  for (let i = 0; i < ids.length; i += DELETE_BATCH_SIZE) {
    const batch = writeBatch(db);
    const slice = ids.slice(i, i + DELETE_BATCH_SIZE);
    for (const id of slice) batch.delete(doc(col, id));
    await batch.commit();
    done += slice.length;
    onProgress?.(done, ids.length);
  }
}
