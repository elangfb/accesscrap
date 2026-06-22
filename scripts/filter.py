#!/usr/bin/env python3
"""
Build targeted outreach lists from the re-scraped directory CSVs.

Aggregates every Document/*.csv and splits businesses into three mutually
exclusive groups, where a "phone" means a mobile number starting with 08
(numbers are stored joined by "; ", so any token may qualify):

  1. Phone (08) AND Email   -> Document/Filtered/Phone (08) AND Email.csv
  2. Phone (08) only         -> Document/Filtered/Phone (08) only.csv
  3. Email only              -> Document/Filtered/Email only.csv

Rows whose only phone is a landline and that have no email fall into none of
the groups (excluded by design).

The two mobile groups also get a "WhatsApp" column: a wa.me click-to-chat link
that opens the number with a prefilled outreach message (scripts/wa_message.txt).
"""
import csv
import glob
import os
import re
import urllib.parse

FIELDNAMES = ['Provinsi', 'Kategori', 'Nama Usaha', 'Alamat Usaha',
              'Nomor Telepon', 'Email', 'Website']
OUT_DIR = 'Document/Filtered'

# Prefilled WhatsApp message. Keep in sync with WA_MESSAGE in lib/wa.ts.
with open(os.path.join(os.path.dirname(__file__), 'wa_message.txt'),
          encoding='utf-8') as _fh:
    WA_MESSAGE = _fh.read().strip()
WA_TEXT = urllib.parse.quote(WA_MESSAGE, safe='')


def has_mobile(telepon):
    """True if any '; '-separated phone token starts with 08."""
    return any(tok.strip().startswith('08') for tok in (telepon or '').split(';'))


def wa_number(telepon):
    """First 08 mobile in the field, as an international wa.me number (62...).
    Returns '' if none. Drops 'Ext:' suffixes and any separators."""
    for tok in (telepon or '').split(';'):
        tok = tok.strip()
        if tok.startswith('08'):
            digits = re.sub(r'\D', '', re.split(r'ext', tok, flags=re.I)[0])
            if len(digits) >= 9:
                return '62' + digits[1:]
    return ''


def wa_link(telepon):
    num = wa_number(telepon)
    return f'https://wa.me/{num}?text={WA_TEXT}' if num else ''


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    groups = {'Phone (08) AND Email': [], 'Phone (08) only': [], 'Email only': []}

    for path in sorted(glob.glob('Document/*.csv')):
        for row in csv.DictReader(open(path, encoding='utf-8-sig')):
            mobile = has_mobile(row.get('Nomor Telepon', ''))
            email = bool((row.get('Email') or '').strip())
            out = {k: row.get(k, '') for k in FIELDNAMES}
            if mobile and email:
                out['WhatsApp'] = wa_link(row.get('Nomor Telepon', ''))
                groups['Phone (08) AND Email'].append(out)
            elif mobile:
                out['WhatsApp'] = wa_link(row.get('Nomor Telepon', ''))
                groups['Phone (08) only'].append(out)
            elif email:
                groups['Email only'].append(out)

    # the two mobile groups carry the extra WhatsApp link column
    for name, rows in groups.items():
        fields = FIELDNAMES + (['WhatsApp'] if name != 'Email only' else [])
        out_path = os.path.join(OUT_DIR, name + '.csv')
        with open(out_path, 'w', newline='', encoding='utf-8-sig') as fh:
            w = csv.DictWriter(fh, fieldnames=fields)
            w.writeheader()
            w.writerows(rows)
        print(f'{name:24s} -> {len(rows):7,d} rows  ({len(fields)} cols)')


if __name__ == '__main__':
    main()
