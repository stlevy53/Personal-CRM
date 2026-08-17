"""
Phase 2 (contacts): extract customer-side POCs from the 'New Games POCs' sheet.

Sheet columns: Team / Game Name | Name | Role | Studio | Subdivision
(The sheet's Studio/Subdivision use its own framing; we link contacts to a CRM
customer (game) when the game name maps to one in data/hierarchy.csv.)

Output (reviewable): data/contacts.csv
  name, role, game, sheet_studio, sheet_subdivision, matched_customer
"""

import csv
import re
import openpyxl

WB_PATH = "docs/Personal-CRM Data.xlsx"
SHEET = "New Games POCs"

# game-name (from sheet) -> CRM customer name (from hierarchy.csv) for non-exact cases
ALIASES = {
    "phoenix studio": "Phoenix",
    "new games / prototypes overall": "New Games Team",
}
SKIP_NAMES = {"", "tbd", "n/a", "tba"}


def norm(s):
    return (str(s).strip() if s is not None else "")


def load_customers():
    customers = {}
    with open("data/hierarchy.csv", newline="", encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            customers[r["customer"].strip().lower()] = r["customer"].strip()
    return customers


def match_customer(game, customers):
    g = game.strip().lower()
    if not g:
        return ""
    if g in customers:
        return customers[g]
    if g in ALIASES and ALIASES[g].lower() in customers:
        return ALIASES[g]
    for key, name in customers.items():
        if g == key or g.startswith(key) or key.startswith(g):
            return name
    return ""


def main():
    customers = load_customers()
    wb = openpyxl.load_workbook(WB_PATH, data_only=True, read_only=True)
    ws = wb[SHEET]
    rows = list(ws.iter_rows(values_only=True))
    header = [norm(c).lower() for c in rows[0]]
    idx = {h: i for i, h in enumerate(header)}
    gi = idx.get("team / game name", 0)
    ni = idx.get("name", 1)
    ri = idx.get("role", 2)
    si = idx.get("studio", 3)
    subi = idx.get("subdivision", 4)

    out = []
    for r in rows[1:]:
        name = norm(r[ni]) if ni < len(r) else ""
        if name.lower() in SKIP_NAMES:
            continue
        game = norm(r[gi]) if gi < len(r) else ""
        role = norm(r[ri]) if ri < len(r) else ""
        studio = norm(r[si]) if si < len(r) else ""
        subdivision = norm(r[subi]) if subi < len(r) else ""
        matched = match_customer(game, customers)
        out.append([name, role, game, studio, subdivision, matched])

    with open("data/contacts.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["name", "role", "game", "sheet_studio", "sheet_subdivision", "matched_customer"])
        w.writerows(out)

    matched = [r for r in out if r[5]]
    unmatched_game = [r for r in out if r[2] and not r[5]]
    no_game = [r for r in out if not r[2]]
    print(f"Wrote data/contacts.csv: {len(out)} contacts "
          f"({len(matched)} linked to a customer, {len(unmatched_game)} have a game but no match, {len(no_game)} have no game)\n")

    print("=== Linked to a CRM customer ===")
    for r in matched:
        print(f"  {r[0]:28} {('('+r[1]+')'):24} -> {r[5]}")
    if unmatched_game:
        print("\n=== Game present but NOT matched to a customer (need decision) ===")
        for r in unmatched_game:
            print(f"  {r[0]:28} {('('+r[1]+')'):24} game='{r[2]}'  [sheet studio='{r[3]}' subdivision='{r[4]}']")
    if no_game:
        print("\n=== No game on row (studio/subdivision-level contact, will be unlinked) ===")
        for r in no_game:
            print(f"  {r[0]:28} {('('+r[1]+')'):24} [sheet studio='{r[3]}' subdivision='{r[4]}']")


if __name__ == "__main__":
    main()
