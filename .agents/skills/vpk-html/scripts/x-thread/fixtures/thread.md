# Ledger 3.0 launch

**Ledger 3.0 is out today.** Three things changed: imports are 5x faster, budgets sync across devices, and every report exports to CSV. A thread on what we measured #cafe #2026

---

Imports first. A 40,000-row bank file now loads in 1.2 s instead of 6.1 s, and the preview shows the first 50 rows before you commit.

![Import preview showing the first 50 rows of a bank file](media/import-preview.png)

<!-- note: Numbers from the release notes, section 2 -->

---

Budgets now sync through your own storage, not ours. Full method and raw timings: [benchmarks](https://example.com/ledger-3-benchmarks)

---

## Literal text stays literal

Template tokens like {{x}} stay as typed, and so do amounts like $1, $& and $'. Field names such as `opening_balance` and snake_case keys survive _unchanged_, and \*stars\* stay.

---

> CSV export covers every report, with one schema and stable column names.

---

Upgrade from the app menu. Thanks to the 64 people who tested the betas. 🙏
