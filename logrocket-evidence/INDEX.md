# LogRocket evidence index (captured 2026-11-23, ~8:25-8:55 PM, GMT+2)

Project: campus-cart. Dashboard: "CampusCart Performance Durations" (id 314463).
Pro trial ends 12/7/26. All charts are 50th percentile (p50) of the numeric `duration_ms`
property of the app's own custom events. No event counts or duration buckets are charted.

## Test sessions (recorded 2026-11-23, local dev, test DB only)
LogRocket does not label the network condition, so it is recorded here from the run log.

| Session start | Condition | Replay id suffix | Notes |
|---|---|---|---|
| 7:53 PM | Normal | ...098a | login, fees, profile, store, 2 checkouts |
| 7:54 PM | Normal | ...098b | login, fees, store, 1 checkout |
| 7:55 PM | Slow 4G | ...098c | login, fees, store, 1 checkout |
| 7:58 PM | Slow 4G | ...098f | login, store, 1 checkout (tab kept open after logout) |

The sessions list also shows two sessions that are NOT part of this run (6:45 PM and an
"Anonymous User" at 7:18 PM, earlier verification). The 6:45 PM one is inside the dashboard's
default "last day" hourly buckets but outside the by-minute views.

## Files
| File | Shows |
|---|---|
| 01_dashboard_overview | Whole dashboard, 3 charts (last day, by hour) |
| 02-04_chart_* | One chart each, title + y-axis + entire-range value (Route 59, API 598, Checkout 866 ms) |
| 05-07_*_by_minute_normal_vs_slow4g | Last hour by 1 min, value table 7:53-8:00 PM |
| 08_sessions_list_four_test_sessions | Session list (user id 3 only) |
| 09, 10, 11, 12 | Checkout Completed event properties (`duration_ms`) per session |
| 13, 14 | Route Navigation Completed `duration_ms` per route, normal vs Slow 4G |
| 15 | API Response events (endpoint without ids, method, status, `duration_ms`) |
| 16 | Privacy: `/api/login` has no request/response headers or bodies |
| 17 | Privacy: replay masks all text, inputs and button labels |

## Key values (ms)
| Metric | Normal 7:53 | Normal 7:54 | Slow 4G 7:55 | Slow 4G 7:58 |
|---|---|---|---|---|
| Route navigation p50 (per minute) | 47 | 46 | 705 | 704 |
| API response p50 (per minute) | 660 | 510 | 597 | 652 |
| Checkout completion p50 (per minute) | 914 | 671 | 918 | 866 |

Per-event examples: normal `/login` 107, `/profile` 44, `/student-fees` 73;
Slow 4G `/login` 2485, `/profile` 705, `/store` 1086.

## Honest reading
- Route navigation is clearly slower under Slow 4G (about 10x or more).
- API response and checkout completion do NOT show a clear slowdown in this data:
  the local Laravel dev server already takes about 0.5 s per call on the normal runs.
