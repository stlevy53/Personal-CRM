"""
Phase 2a ETL: extract your-side people + pods from the 'Pod Info' sheet.

'Pod Info' columns: Team | pod | Engineering POC | Product POC | Production POC
Each POC cell is a person; a person can appear in multiple pods/roles.

Outputs (reviewable; you can append people missing from the sheet):
  data/pods.csv    -> pod, team
  data/people.csv  -> name, initials, pod, roles
"""

import csv
import os
import re
import openpyxl

WB_PATH = "docs/Personal-CRM Data.xlsx"
ROLE_COLS = {
    "engineering poc": "Engineering",
    "product poc": "Product",
    "production poc": "Production",
}


def norm(s):
    return (str(s).strip() if s is not None else "")


def initials(name):
    words = [w for w in re.split(r"\s+", name.strip()) if re.search(r"[A-Za-z0-9]", w)]
    if not words:
        return "?"
    if len(words) == 1:
        return words[0][:2].upper()
    return (words[0][0] + words[-1][0]).upper()


def split_names(cell):
    # A cell may (rarely) hold multiple people separated by newline / comma / slash.
    parts = re.split(r"[\n,/&]+", cell)
    return [p.strip() for p in parts if p.strip()]


def main():
    wb = openpyxl.load_workbook(WB_PATH, data_only=True, read_only=True)
    ws = wb["Pod Info"]

    rows = list(ws.iter_rows(values_only=True))
    header = [norm(c).lower() for c in rows[0]]
    idx = {h: i for i, h in enumerate(header)}
    team_i = idx.get("team", 0)
    pod_i = idx.get("pod", 1)
    role_idx = {label: idx[h] for h, label in ROLE_COLS.items() if h in idx}

    pods = {}    # pod -> team (first seen)
    people = {}  # name -> {initials, pods:set, roles:set}

    for row in rows[1:]:
        team = norm(row[team_i])
        pod = norm(row[pod_i])
        if not pod:
            continue
        pods.setdefault(pod, team)
        for role, ci in role_idx.items():
            cell = norm(row[ci]) if ci < len(row) else ""
            for name in split_names(cell):
                p = people.setdefault(name, {"initials": initials(name), "pods": [], "roles": set()})
                if pod not in p["pods"]:
                    p["pods"].append(pod)
                p["roles"].add(role)

    os.makedirs("data", exist_ok=True)

    with open("data/pods.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["pod", "team"])
        for pod, team in pods.items():
            w.writerow([pod, team])

    with open("data/people.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["name", "initials", "pod", "roles"])
        for name, p in sorted(people.items()):
            w.writerow([name, p["initials"], p["pods"][0], ";".join(sorted(p["roles"]))])

    print(f"Wrote data/pods.csv ({len(pods)} pods) and data/people.csv ({len(people)} people)\n")
    for pod, team in pods.items():
        members = [n for n, p in people.items() if p["pods"][0] == pod]
        print(f"POD: {pod}  (team: {team})")
        for n in members:
            print(f"    - {n} [{people[n]['initials']}] ({';'.join(sorted(people[n]['roles']))})")
    multi = {n: p for n, p in people.items() if len(p["pods"]) > 1}
    if multi:
        print("\nPeople in multiple pods (primary pod = first listed):")
        for n, p in multi.items():
            print(f"    - {n}: {', '.join(p['pods'])}")


if __name__ == "__main__":
    main()
