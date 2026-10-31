# P55 byte units and login day count

## Unit audit

Tracker pages print `kB`/`MB`/`GB`/`TB` for values divided by 1024 at every
step. They are IEC units with decimal-looking labels, so site-printed totals
are read as binary (`GiB`/`TiB`) unless a page carries evidence for decimal.
The API adapters that receive JSON byte counts are outside this audit.

| Tracker | Field | Reading | Evidence |
| --- | --- | --- | --- |
| AvistaZ (and its network) | Ratio-bar uploaded/downloaded | binary | Profile prints `97.30 GB (99,637 MB)`. `99,637 MB / 1024 = 97.30`, while `/ 1000 = 99.64`. The MB column is MiB and the GB label is GiB. |
| TorrentLeech | Profile uploaded/downloaded | binary (default) | Profile prints `966.16 GB` and `292.7 GB`; no page value pairs a GB label with a decimal byte count. Binary is the default for page labels. |
| RetroToon World | `userdetails.php` uploaded/downloaded | binary | TBDev template (`userdetails.php`, `td.rowhead` rows). TBDev `mksize()` divides by 1024 at every step but labels the result kB, MB, GB and TB. |
| FileList | `userdetails.php` uploaded/downloaded and seed size | binary | TBDev template, same `mksize()` behaviour. Already read through the TBDev parser before this change. |
| CarPT | Header uploaded/downloaded | binary | NexusPHP template. NexusPHP `mksize()` divides by 1024 and labels the result KB, MB, GB and TB. |
| Portugas | Ratio-bar uploaded/downloaded/buffer and seed size | binary | Custom UNIT3D build. UNIT3D's byte formatter divides by 1024; the captured profile prints explicit `GiB`/`MiB` labels. |
| IPTorrents | Stats-bar uploaded/downloaded | binary (default) | The page prints `GB`/`MB` with no decimal marker or paired raw count. Binary is the default for page labels. |
| UNIT3D API trackers | JSON `uploaded`, `downloaded`, `buffer` | explicit IEC unit | The API prints `500.25 GiB`; `parseBytes` reads the explicit suffix and is unchanged. |
| Gazelle, GGn, MAM, Nebulance, BTN, C411, DigitalCore, Hawke, TR4KER, V3X, M-Team | JSON byte counts | not applicable | These adapters receive byte counts as JSON numbers, not printed size strings. |

The shared site parser now maps every page label to its binary unit:
`kB`/`KB` to `KiB`, `MB` to `MiB`, `GB` to `GiB`, `TB` to `TiB` and `PB` to
`PiB`. Explicit IEC labels keep their stated unit.

## Stored history

Snapshots already in the database are not rewritten. The next poll after this
change stores the corrected (roughly 7% higher for GB and 10% higher for TB)
byte totals, so volume charts show a one-time step at that poll. That step is
expected; there is no backfill.
