# LogRocket evidence index (captured 2026-11-23, ~8:25-8:55 PM, GMT+2)

Addendum 2026-11-24: screenshot 18 and the `privacy-safe/` copies were added, and the session
notes below were clarified. No screenshot or measurement captured on 2026-11-23 was changed.

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

**Only the four sessions in the table above are the case study** (23 Nov, 7:53-7:58 PM,
GMT+2, two Normal and two Slow 4G). Every other session in the project is unrelated to it:

| Session start (GMT+2) | User | Events | Why it is not part of the case study |
|---|---|---|---|
| 23 Nov 6:45 PM | 3 | 12 | Earlier verification, before the case study |
| 23 Nov 7:18 PM | Anonymous | 1 | Earlier verification, before the case study |
| 23 Nov 8:44 PM | Anonymous | 2 | After the case study, unlabelled local visit |
| 23 Nov 11:10 PM | Anonymous | 4 | After the case study, unlabelled local visit |
| 24 Nov 8:12 AM, 9:02 AM, 9:44 AM | Anonymous | 3, 2, 2 | Unlabelled local visits |
| 24 Nov 9:23 PM | Anonymous | 5 | Manual browser check of the Page Not Found screen (not throttled) |
| 24 Nov 9:28 PM | 3 | 26 | Manual browser check of profile edit/delete (not throttled) |

(Counts as listed on 24 Nov, about 10 PM GMT+2: 13 sessions in the last week.) The 24 Nov
sessions are real measurements from the current build, but they are not a normal-vs-Slow-4G
comparison and are not used in any value below. They do show the three metrics still report after
the latest changes.

**Viewing the case study on the live dashboard.** The dashboard opens on "Last day", which no
longer contains the 23 Nov sessions, so its default view now shows other data (and an empty
checkout chart). To see the case study, set a custom date range of 23 Nov, 7:30-8:30 PM, by 1 min.
Screenshot 18 shows exactly that view. The range is a temporary view filter and was not saved to
the dashboard. The Pro trial ends 12/7/26, so keep the screenshots as the permanent record.

## Files
| File | Shows |
|---|---|
| 01_dashboard_overview | Whole dashboard, 3 charts (last day, by hour) |
| 02-04_chart_* | One chart each, title + y-axis + entire-range value (Route 59, API 598, Checkout 866 ms) |
| 05-07_*_by_minute_normal_vs_slow4g | Last hour by 1 min, value table 7:53-8:00 PM |
| 08_sessions_list_four_test_sessions | Session list, "Last Week" filter at capture time. **It shows six sessions, not four:** the four case-study sessions (7:53, 7:54, 7:55, 7:58 PM) plus two unrelated earlier ones (6:45 PM, user 3, and an Anonymous User at 7:18 PM). The file name is kept as captured; the privacy-safe copy is named `..._six_sessions_four_case_study_...`. |
| 09, 10, 11, 12 | Checkout Completed event properties (`duration_ms`) per session |
| 13, 14 | Route Navigation Completed `duration_ms` per route, normal vs Slow 4G |
| 15 | API Response events (endpoint without ids, method, status, `duration_ms`) |
| 16 | Privacy: `/api/login` has no request/response headers or bodies |
| 17 | Privacy: replay masks all text, inputs and button labels |
| 18_dashboard_all_three_metrics_case_study_window_by_minute | Added 24 Nov 2026 (about 10 PM GMT+2). The whole dashboard with the temporary custom range 23 Nov 7:30-8:30 PM, by 1 min: all three charts show the case-study window (peaks 705 ms route, 660 ms API, 918 ms checkout). Filter not saved. |

## Privacy-safe copies (`privacy-safe/`)
Screenshots 01-08 and 18 were taken in the LogRocket app, so the left sidebar shows the account
email at the bottom-left. `privacy-safe/` holds copies with the left 280 px (the sidebar) cropped
off: `01_..._no-email.png` to `07_..._no-email.png`, `08_sessions_list_six_sessions_four_case_study_no-email.png`
and `18_..._no-email.png`. Nothing else is cut: chart titles, dates, axes, values and event details
are all inside the kept area. Screenshots 09-17 are session-replay views with no sidebar, so they
contain no email and have no copy. All original files are unchanged.

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
- The sample is small (two sessions per condition, one local machine, a development server).
  It illustrates the effect of throttling on page navigation; it is not a benchmark.
