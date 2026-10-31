# P51 seedpool upload gain investigation

Date: 2026-10-31

Question: seedpool showed an upload gain of exactly +512.00 GiB today. Is that a
real transfer (for example bonus points exchanged for upload credit), or a data
error?

## Data access in this checkout

The configured development database contains seven trackers and none is
seedpool:

| id | name       | registry slug |
| -- | ---------- | ------------- |
| 1  | FileList   | filelist      |
| 2  | FileList   | filelist      |
| 3  | M-Team     | mteam         |
| 4  | Zenith     | zenith        |
| 5  | Portugas   | portugas      |
| 6  | CarPT      | carpt         |
| 7  | V3X        | v3x           |

No seedpool snapshot rows exist in `tracker_tracker` or `tracker_tracker_e2e`.
The live values for the two snapshots that produced the tile were therefore not
available to this checkout, and none were invented.

The query that returns the evidence for a real installation is:

```sql
select s.id, s.polled_at, s.uploaded_bytes, s.downloaded_bytes,
       s.buffer_bytes, s.ratio, s.seedbonus, s.is_manual
from tracker_snapshots s
join trackers t on t.id = s.tracker_id
where t.registry_slug = 'seedpool'
  and s.polled_at >= date_trunc('day', now())
order by s.polled_at, s.id;
```

The tile compares the first and last snapshot of the local day, not a rolling
24 hours.

## Code-path audit

- `Unit3dAdapter.fetchStats` maps UNIT3D's `uploaded` field through `toBytes`
  only (`src/lib/tracker-platforms/adapters/unit3d.ts`). It does not add seed
  size, bonus points or profile values to upload.
- The scheduler stores the adapter's `uploadedBytes` in
  `tracker_snapshots.uploaded_bytes` unchanged.
- `computeTodayAtAGlance` subtracts the first snapshot's `uploaded_bytes` from
  the last snapshot's `uploaded_bytes` for the same tracker
  (`src/lib/today.ts`). It does not read `seedbonus` for upload, and the per
  tracker yesterday comparison uses the separate daily checkpoints.
- P49 profile reading stores `seedSizeBytes` under `platformMeta.profileRead`
  and never writes it to `uploaded_bytes` (`src/lib/rank-observations.ts`).
- Seedpool's 512 GiB registry thresholds are rank conditions only
  (`src/data/trackers/seedpool.ts`); they are not transfer data.
- No code path uses a 512 GiB constant when writing a snapshot.

## Reading the values

A real bonus-for-upload exchange has this signature:

- last snapshot `uploaded_bytes` minus first snapshot `uploaded_bytes` is
  549,755,813,888 bytes (exactly 512 GiB, which is why the tile prints
  `+512.00 GiB`);
- `downloaded_bytes` does not move with it;
- `buffer_bytes` and `ratio` move consistently with the larger upload;
- `seedbonus` falls by the exchange price.

A data error would not normally produce that exact binary number. The plausible
error signatures are different: a repeated or backfilled snapshot, a manual
snapshot with the wrong value, a unit change on the tracker, or a snapshot from
another account. None of those is visible in the aggregation code, and the
adapter has no GiB-to-byte conversion that could turn a seed-size value into an
upload value.

## Finding

The +512.00 GiB gain is consistent with a real seedpool bonus exchange for
upload credit, not with an application data error. No fix was applied. If the
live rows show upload moving without the matching buffer/ratio change, or show a
manual snapshot with the same value, treat that row as the error instead of the
aggregation.
