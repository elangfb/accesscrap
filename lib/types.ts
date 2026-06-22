export type ContactStatus =
  | "not_contacted"
  | "contacted"
  | "responded"
  | "not_interested"
  | "follow_up"
  | "converted";

export interface Business {
  id: string;
  provinsi: string;
  kategori: string;
  nama: string;
  alamat: string;
  telepon: string;
  email: string;
  website: string;
  status: ContactStatus;
  notes: string;
  lastContactedAt: number | null;
  sourceFile: string;
  dedupeKey: string;
  createdAt: number;
  updatedAt: number;
}

export interface ContactLog {
  id: string;
  businessId: string;
  status: ContactStatus;
  note: string;
  contactedAt: number;
}

export const STATUS_META: Record<
  ContactStatus,
  { label: string; color: string; badge: string }
> = {
  not_contacted: {
    label: "Not Contacted",
    color: "text-slate-600",
    badge: "bg-slate-100 text-slate-700 border-slate-200",
  },
  contacted: {
    label: "Contacted",
    color: "text-blue-600",
    badge: "bg-blue-100 text-blue-700 border-blue-200",
  },
  responded: {
    label: "Responded",
    color: "text-indigo-600",
    badge: "bg-indigo-100 text-indigo-700 border-indigo-200",
  },
  not_interested: {
    label: "Not Interested",
    color: "text-rose-600",
    badge: "bg-rose-100 text-rose-700 border-rose-200",
  },
  follow_up: {
    label: "Follow Up",
    color: "text-amber-600",
    badge: "bg-amber-100 text-amber-700 border-amber-200",
  },
  converted: {
    label: "Converted / Deal",
    color: "text-emerald-600",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
};

export const STATUS_ORDER: ContactStatus[] = [
  "not_contacted",
  "contacted",
  "responded",
  "follow_up",
  "converted",
  "not_interested",
];
