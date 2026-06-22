// WhatsApp click-to-chat helpers. The phone field holds one or more numbers
// joined by "; "; the first mobile (starting with 08) is turned into a wa.me
// deep link that opens the chat with a prefilled outreach message.

// Prefilled message. Keep in sync with scripts/wa_message.txt.
export const WA_MESSAGE = `Selamat Siang, perkenalkan saya Ufi dari Kementerian UMKM Republik Indonesia

Saat ini, Kementerian UMKM membuka kesempatan bagi Usaha Menengah untuk mengakses pembiayaan melalui program ACCES 2026

Melalui program ini, peserta akan mendapatkan:
- Pendampingan pembiayaan secara intensif
- Business matching dengan lembaga pembiayaan
- Kemitraan strategis dengan perbankan maupun non-perbankan

Potensi pendanaan hingga Rp20 miliar

Kriteria Peserta:
- Usaha menengah dengan omzet Rp15-50 miliar/tahun
- Legalitas usaha lengkap
- Memiliki laporan keuangan 2 tahun terakhir
- Memiliki kebutuhan pembiayaan dan potensi pertumbuhan yang terukur

Informasi lengkap program dapat diakses melalui https://accescapital.id/

Program ini diadakan secara resmi oleh Kementerian UMKM, gratis dan tidak dipungut biaya apapun`;

// First 08 mobile in the field as an international wa.me number (62...), or ""
// if none. Drops "Ext:" suffixes and any separators.
export function toWaNumber(telepon: string): string {
  for (const raw of (telepon ?? "").split(";")) {
    const tok = raw.trim();
    if (tok.startsWith("08")) {
      const digits = tok.split(/ext/i)[0].replace(/\D/g, "");
      if (digits.length >= 9) return "62" + digits.slice(1);
    }
  }
  return "";
}

// Full click-to-chat link with the prefilled message, or "" when no mobile.
export function waLink(telepon: string): string {
  const num = toWaNumber(telepon);
  return num
    ? `https://wa.me/${num}?text=${encodeURIComponent(WA_MESSAGE)}`
    : "";
}
