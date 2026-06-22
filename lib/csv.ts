import Papa from "papaparse";
import type { Business, ContactStatus } from "./types";

interface RawRow {
  Provinsi?: string;
  Kategori?: string;
  "Nama Usaha"?: string;
  "Alamat Usaha"?: string;
  "Nomor Telepon"?: string;
  Email?: string;
  Website?: string;
  [key: string]: string | undefined;
}

export interface ParsedBusiness {
  provinsi: string;
  kategori: string;
  nama: string;
  alamat: string;
  telepon: string;
  email: string;
  website: string;
}

// Normalize a field for dedupe comparison: lowercase, trim, collapse
// whitespace, and strip common punctuation that varies between exports.
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,;:'"()[\]/\\\-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Composite uniqueness key: business name + address. Phone is intentionally
// excluded because it's frequently empty in the source CSVs.
export function computeDedupeKey(parsed: ParsedBusiness): string {
  return `${norm(parsed.nama)}|${norm(parsed.alamat)}`;
}

export function parseCsv(file: File): Promise<ParsedBusiness[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<RawRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const rows = res.data
          .map((r) => ({
            provinsi: (r.Provinsi ?? "").trim(),
            kategori: (r.Kategori ?? "").trim(),
            nama: (r["Nama Usaha"] ?? "").trim(),
            alamat: (r["Alamat Usaha"] ?? "").trim(),
            telepon: (r["Nomor Telepon"] ?? "").trim(),
            email: (r.Email ?? "").trim(),
            website: (r.Website ?? "").trim(),
          }))
          .filter((r) => r.nama.length > 0);
        resolve(rows);
      },
      error: reject,
    });
  });
}

export function makeBusiness(
  parsed: ParsedBusiness,
  sourceFile: string
): Omit<Business, "id"> {
  const now = Date.now();
  return {
    provinsi: parsed.provinsi,
    kategori: parsed.kategori,
    nama: parsed.nama,
    alamat: parsed.alamat,
    telepon: parsed.telepon,
    email: parsed.email,
    website: parsed.website,
    status: "not_contacted" as ContactStatus,
    notes: "",
    lastContactedAt: null,
    sourceFile,
    dedupeKey: computeDedupeKey(parsed),
    createdAt: now,
    updatedAt: now,
  };
}
