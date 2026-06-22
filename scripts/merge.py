#!/usr/bin/env python3
"""
Merge the 3 filtered outreach lists (produced by filter.py) into a single file
at Document/Filtered/All Contacts.csv. A leading "Grup Kontak" column records
which group each business came from; the WhatsApp column is blank for the
email-only group. The groups are mutually exclusive, so there are no duplicates.
"""
import csv
import os

DIR = 'Document/Filtered'
OUT = os.path.join(DIR, 'All Contacts.csv')
FIELDNAMES = ['Grup Kontak', 'Provinsi', 'Kategori', 'Nama Usaha',
              'Alamat Usaha', 'Nomor Telepon', 'Email', 'Website', 'WhatsApp']

SOURCES = [
    ('Phone & Email', 'Phone (08) AND Email.csv'),
    ('Phone Only', 'Phone (08) only.csv'),
    ('Email Only', 'Email only.csv'),
]


def main():
    total = 0
    with open(OUT, 'w', newline='', encoding='utf-8-sig') as out:
        w = csv.DictWriter(out, fieldnames=FIELDNAMES)
        w.writeheader()
        for group, fname in SOURCES:
            n = 0
            for row in csv.DictReader(open(os.path.join(DIR, fname),
                                           encoding='utf-8-sig')):
                rec = {k: row.get(k, '') for k in FIELDNAMES}
                rec['Grup Kontak'] = group
                w.writerow(rec)
                n += 1
            total += n
            print(f'  + {n:7,d}  {group}')
    print(f'merged {total:,} rows -> {OUT}')


if __name__ == '__main__':
    main()
