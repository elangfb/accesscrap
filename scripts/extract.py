#!/usr/bin/env python3
"""
Re-scrape the BPS "Direktori Usaha Menengah" PDFs, this time KEEPING the
email (and website) that the original CSV export dropped.

The PDFs lay out businesses in a 3-column "card" grid. Each card is:
    <business name>            (a slightly larger font; bold in most files)
    <address line(s)>          (smallest font)
    <phone(s)>
    <email>
    <website>
The province is carried either as a "PROVINSI <name>" running header or, in the
Industri Pengolahan books, as a bare province-name header. KATEGORI gives the
category; KBLI / regency (KAB./KOTA) / 2-digit sub-category lines act as
in-column section separators.

Reading order = column 0 top->bottom, then column 1, then column 2 (this is
the exact order the original CSV rows are in).
"""
import csv
import re
import sys
import os
import glob
import fitz  # PyMuPDF

WHITE = 16777215
COL_BOUNDS = (215, 400)  # x0 < 215 -> col0 ; < 400 -> col1 ; else col2

# The 34 provinces as spelled in the source directories (drives province
# detection for both "PROVINSI X" headers and the bare headers used by the
# Industri Pengolahan books).
PROVINCE_SET = {
    'ACEH', 'SUMATERA UTARA', 'SUMATERA BARAT', 'RIAU', 'JAMBI',
    'SUMATERA SELATAN', 'BENGKULU', 'LAMPUNG', 'KEPULAUAN BANGKA BELITUNG',
    'KEPULAUAN RIAU', 'DKI JAKARTA', 'JAWA BARAT', 'JAWA TENGAH',
    'DI YOGYAKARTA', 'JAWA TIMUR', 'BANTEN', 'BALI', 'NUSA TENGGARA BARAT',
    'NUSA TENGGARA TIMUR', 'KALIMANTAN BARAT', 'KALIMANTAN TENGAH',
    'KALIMANTAN SELATAN', 'KALIMANTAN TIMUR', 'KALIMANTAN UTARA',
    'SULAWESI UTARA', 'SULAWESI TENGAH', 'SULAWESI SELATAN',
    'SULAWESI TENGGARA', 'GORONTALO', 'SULAWESI BARAT', 'MALUKU',
    'MALUKU UTARA', 'PAPUA', 'PAPUA BARAT',
}

KATEGORI_RE = re.compile(r'^KATEGORI\s+(.*)$', re.I)
PROVINSI_RE = re.compile(r'^PROVINSI\s+(.*)$', re.I)
KAB_RE = re.compile(r'^(KAB\.|KOTA\s|KABUPATEN)\b', re.I)
SUBCAT_RE = re.compile(r'^\d{2}\s')             # "52 PERGUDANGAN ..."
KBLI_RE = re.compile(r'^KBLI\b', re.I)
EMAIL_RE = re.compile(r'[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}')
WEB_RE = re.compile(r'(www\.|https?://)', re.I)
FOOTER_RE = re.compile(r'^(Direktori Usaha|Directory of)', re.I)


def column_of(x0):
    if x0 < COL_BOUNDS[0]:
        return 0
    if x0 < COL_BOUNDS[1]:
        return 1
    return 2


def detect_province(text):
    """Return the province name if this header line names a province, else None.
    Handles both 'PROVINSI ACEH' and a bare 'KALIMANTAN TENGAH'."""
    t = text.strip().upper()
    m = PROVINSI_RE.match(t)
    if m:
        t = m.group(1).strip()
    return t if t in PROVINCE_SET else None


def is_phone(text):
    t = text.strip()
    if not t or '@' in t:
        return False
    # strip "Ext"/"ext" notations, then it should be only digits & separators
    t2 = re.sub(r'\b[eE]xt\b', '', t)
    if not re.fullmatch(r'[\d\s\-\(\)\.\:\+/xX,;]+', t2):
        return False
    digits = sum(c.isdigit() for c in t)
    if digits < 5:
        return False
    # A bare 4-6 digit run with no separator that does not start with 0 is an
    # Indonesian postal code, not a phone number -> leave it in the address.
    compact = re.sub(r'\D', '', t)
    if t == compact and 4 <= len(compact) <= 6 and not compact.startswith('0'):
        return False
    return True


def detect_name_style(doc, data_pages):
    """Return (name_is_bold,) deciding how names are distinguished.

    Most files: names are BOLD at size 6.3-8.4 (data is smaller/regular).
    Pengangkutan: nothing is bold; names are the ~7pt lines.
    """
    bold_names = 0
    for p in data_pages[:25]:
        for b in doc[p].get_text('dict')['blocks']:
            for l in b.get('lines', []):
                for s in l['spans']:
                    if s.get('color') == 0 and 'Bold' in s['font'] and 6.0 <= round(s['size'], 1) <= 8.4:
                        bold_names += 1
    return bold_names > 30


HEADER_TOP = 60  # lines above this y are the page running header, not card body


def _classify_line(top, x0, size, bold, text, name_is_bold):
    # Province / category headers (checked first; a bare province name is
    # header-sized and must not be mistaken for a regency).
    if size >= 8.6 and detect_province(text):
        return ('province', detect_province(text), top, None)
    if KATEGORI_RE.match(text):
        return ('kategori', KATEGORI_RE.match(text).group(1).strip(), top, None)
    if PROVINSI_RE.match(text):
        prov = detect_province(text)
        return ('province', prov or PROVINSI_RE.match(text).group(1).strip(), top, None)
    if (size >= 8.6 or KAB_RE.match(text) or SUBCAT_RE.match(text)
            or KBLI_RE.match(text) or FOOTER_RE.match(text)):
        return ('kab', text, top, None)   # section separator (not emitted)
    if name_is_bold:
        name = bold and 6.0 <= size <= 8.4
    else:
        name = (6.6 <= size <= 7.6)
    return ('name' if name else 'data', text, top, None)


def line_records(doc, page_idx, name_is_bold):
    """Yield ('province'|'kategori'|'kab'|'name'|'data', text, top, col) tokens.

    The page running header (PROVINSI / KATEGORI) is physically in column 2 but
    applies to the whole page, so it is emitted FIRST; the card body then follows
    in reading order col0->col1->col2, top->bottom."""
    page = doc[page_idx]
    cols = {0: [], 1: [], 2: []}
    header_lines = []
    for b in page.get_text('dict')['blocks']:
        for l in b.get('lines', []):
            # Drop the watermark: the white "https://www.bps.go.id" letters and
            # the big black 24pt diagonal stamp (no real content exceeds ~9pt).
            spans = [s for s in l['spans']
                     if s.get('color') != WHITE and s['text'].strip()
                     and round(s['size'], 1) < 10
                     and 'bps.go.id' not in s['text'].lower()]
            if not spans:
                continue
            # split the line's spans by column (defensive against cross-column lines)
            by_col = {}
            for s in spans:
                c = column_of(s['bbox'][0])
                by_col.setdefault(c, []).append(s)
            for c, ss in by_col.items():
                ss.sort(key=lambda s: s['bbox'][0])
                text = re.sub(r'\s+', ' ', ' '.join(s['text'] for s in ss)).strip()
                if not text:
                    continue
                size = round(max(s['size'] for s in ss), 1)
                bold = any('Bold' in s['font'] for s in ss)
                top = min(s['bbox'][1] for s in ss)
                x0 = min(s['bbox'][0] for s in ss)
                if top < HEADER_TOP:
                    header_lines.append((top, x0, size, bold, text))
                else:
                    cols[c].append((top, x0, size, bold, text))

    # page-level running header first
    for top, x0, size, bold, text in sorted(header_lines):
        kind, val, t, _ = _classify_line(top, x0, size, bold, text, name_is_bold)
        if kind in ('province', 'kategori'):
            yield (kind, val, t, None)
    # then card body in reading order
    for c in (0, 1, 2):
        for top, x0, size, bold, text in sorted(cols[c], key=lambda r: (r[0], r[1])):
            kind, val, t, _ = _classify_line(top, x0, size, bold, text, name_is_bold)
            yield (kind, val, t, c)


def classify(record):
    """record = {'fields': [..]} -> (alamat, telepon, email, website)"""
    addr, phones, emails, webs = [], [], [], []
    for f in record['fields']:
        if EMAIL_RE.search(f):
            for m in EMAIL_RE.findall(f):
                emails.append(m)
            leftover = EMAIL_RE.sub('', f).strip(' ,;')
            if leftover and not WEB_RE.search(leftover) and not is_phone(leftover):
                addr.append(leftover)
        elif WEB_RE.search(f):
            webs.append(f.strip())
        elif is_phone(f):
            phones.append(f.strip())
        else:
            addr.append(f.strip())
    return (' '.join(addr).strip(),
            '; '.join(phones),
            '; '.join(dict.fromkeys(emails)),
            '; '.join(webs))


def parse_pdf(path):
    doc = fitz.open(path)
    # A data page carries a "KATEGORI ..." running header at the top; this also
    # catches sparse section pages that hold only a handful of businesses. The
    # span-count fallback covers any data page whose header didn't parse.
    data_pages = []
    for i in range(doc.page_count):
        n = 0
        has_header = False
        for b in doc[i].get_text('dict')['blocks']:
            for l in b.get('lines', []):
                if l['bbox'][1] < HEADER_TOP:
                    txt = ''.join(s['text'] for s in l['spans']).strip()
                    if KATEGORI_RE.match(txt):
                        has_header = True
                for s in l['spans']:
                    if s.get('color') == 0 and round(s['size'], 1) <= 7.0:
                        n += 1
        if has_header or n > 20:
            data_pages.append(i)
    name_is_bold = detect_name_style(doc, data_pages)

    rows = []
    province = ''
    kategori = ''
    cur = None

    def flush():
        nonlocal cur
        if cur and cur['nama']:
            alamat, telp, email, web = classify(cur)
            rows.append({
                'Provinsi': cur['prov'], 'Kategori': cur['kat'],
                'Nama Usaha': cur['nama'], 'Alamat Usaha': alamat,
                'Nomor Telepon': telp, 'Email': email, 'Website': web,
            })
        cur = None

    for p in data_pages:
        for kind, text, top, col in line_records(doc, p, name_is_bold):
            if kind == 'province':
                province = text
                flush()
            elif kind == 'kategori':
                kategori = text
                flush()
            elif kind == 'kab':
                flush()
            elif kind == 'name':
                # A long business name can wrap onto a second name-styled line.
                # Treat consecutive name lines in the same column (before any
                # data line) as one wrapped name; otherwise start a new business.
                if cur and not cur['fields'] and cur['col'] == col:
                    cur['nama'] = (cur['nama'] + ' ' + text).strip()
                else:
                    flush()
                    cur = {'prov': province, 'kat': kategori, 'nama': text,
                           'fields': [], 'col': col}
            else:  # data
                if cur:
                    cur['fields'].append(text)
    flush()
    return rows


FIELDNAMES = ['Provinsi', 'Kategori', 'Nama Usaha', 'Alamat Usaha',
              'Nomor Telepon', 'Email', 'Website']


def main():
    # By default re-scrape every PDF and overwrite its sibling .csv in place
    # (originals are preserved in git history). Pass PDF paths to limit the run.
    targets = sys.argv[1:] or glob.glob('Document/*.pdf')
    for path in targets:
        rows = parse_pdf(path)
        out = os.path.splitext(path)[0] + '.csv'
        with_email = sum(1 for r in rows if r['Email'])
        with_web = sum(1 for r in rows if r['Website'])
        with open(out, 'w', newline='', encoding='utf-8-sig') as fh:
            w = csv.DictWriter(fh, fieldnames=FIELDNAMES)
            w.writeheader()
            w.writerows(rows)
        print(f'{os.path.basename(out)[:52]:52s} rows={len(rows):6d} '
              f'email={with_email:6d} web={with_web:6d}')


if __name__ == '__main__':
    main()
