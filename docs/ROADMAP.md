# Roadmap

Status source: `docs/IMPLEMENTATION_STATUS.md`. This file is a one-screen index, not a second status document.

| Phase | Status        | PR                                  |
| ----- | ------------- | ----------------------------------- |
| P00   | done          | —                                   |
| P01   | done          | #1                                  |
| P02   | done          | #1                                  |
| P03   | done          | #3                                  |
| P04   | done          | #4                                  |
| P05   | done          | #5                                  |
| P06   | done          | #6                                  |
| P07   | done          | #7                                  |
| P08   | done          | #8                                  |
| P09   | done          | #9                                  |
| P10   | superseded    | #10 (superseded by P29)             |
| P11   | done          | #13                                 |
| P12   | removed       | #16 (removed in P59)                |
| P13   | removed       | #17 (UX fix #18; removed in P59)    |
| P14   | removed       | #20 (removed in P59)                |
| P15   | removed       | #23 (removed in P59)                |
| P16   | hidden        | #24                                 |
| P17   | done          | #26                                 |
| P18   | done          | #27                                 |
| P19   | removed       | #28 (removed in P59)                |
| P20   | removed       | #29 (removed in P59)                |
| P21   | frozen        | —                                   |
| P22   | frozen        | —                                   |
| P23   | frozen        | —                                   |
| P24   | frozen        | — (monitoring only)                 |
| P25   | done          | #31                                 |
| P26   | done          | #32 + #35                           |
| P27   | frozen        | #37 (parked)                        |
| P28   | done          | #38                                 |
| P29   | done          | #39                                 |
| P30   | done          | #40                                 |
| P31   | pending (next) | —                                   |

Hidden means the UI entry point is removed, but the code, database tables, migrations, stored data and backups are unchanged: P16.

Removed means the feature code, routes, components, settings UI, tests and e2e specs were deleted in P59: P12–P15 and P19–P20. Applied migration `0004_prowlarr` is not edited and is not reversed, so the unused `app_settings` columns remain in existing databases; backups that still contain those settings restore with the fields ignored.

Frozen means no further work is planned: P21–P24 and P27 (PR #37 parked).

Next up: P31 tracker pathways, then a design pass.
