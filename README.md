# LLM Arena widget (v0.7)

## Install once
Install Scriptable, replace the existing AI Radar script with [AI-Radar.js](AI-Radar.js) (v0.7), and keep the existing widget attached to that script. Normal monthly data and eligibility updates do not require reinstalling or copying code. Future changes to native UI or script functionality may require a deliberate script upgrade; the widget never executes downloaded JavaScript.

Set a small/medium widget's Parameter to one category: search, work, text, reasoning, writing, instruction, vision, documents, webdev, agent, chatagent, steering, image, editing, video, imagevideo, videoedit. For large widgets use up to five comma-separated categories, or edit the defaults in Settings. Coding/math are excluded; web development remains separate. Reasoning uses Arena Hard Prompts; Work uses agent capability / work, not a differently scaled index.

## Monthly architecture
- GitHub Actions collects official Arena data on day 1 of each month at 05:17 UTC (06:17 CET / 07:17 CEST), or on an explicit manual run. Source-code and access-registry pushes run CI only; they do not collect rankings.
- The collector publishes [data/latest.json](data/latest.json) and [data/widget.json](data/widget.json). The latter is the compact, ranked dataset read by the widget. It keeps category publication dates, completeness flags and a rolling 100-day history for prior-month comparisons.
- [data/access.json](data/access.json) is a separately maintained, sourced consumer access registry with schemaVersion 1, review dates, provider URLs, exact model IDs, scope and expiry dates. Review monthly; update this JSON without changing the script. A free chatbot or downloadable model does not establish that every ranked model or effort is free. API-only credits, trials, and open weights are not consumer free access.
- Scriptable checks the published JSON files on its next system-scheduled refresh, at most once per day after a successful check of each file, and caches both locally. It does not scrape Arena. A manual "Refresh published data" action checks the published files without triggering collection. No personal settings are uploaded. Native widget refresh timing is controlled by Apple.
- If a fetch fails, use cached validated data; show cached/partial status rather than invent data. Provider access may expire between reviews. A stale registry (>62 days) or expired entry does not qualify automatically.

## Widget
Small and medium show one category. Large shows up to five; arrows compare the most recent recorded observation in the previous calendar month, with a gray dash when equal. No trend when history is missing. No branding or refresh footer. Tap a model to open its provider website; unknown destinations fall back to Arena. Small widgets open the category model list because Apple supports only one tap target. Settings includes a top-20 browser, model-access overrides and a free-tier provider directory. Access labels marked ? / verify are candidates, not guaranteed entitlements; confirmed options take priority. Exact benchmark configuration may differ from the consumer chat product. Check applicable age, region, account, and usage restrictions. 

## Validation
`python -m unittest -v test_logic.py` and `node test_widget.cjs` run before publication. The v0.7 mocked-runtime regression suite passed 57 assertions, including ranking and access JSON updates with unchanged script, cache reuse and month-on-month movement. Native device rendering and the next scheduled run still need verification. The existing Search feed is a dated partial snapshot; it must not be presented as a complete official dataset.

Official ranking source: https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset
Scriptable documentation: https://docs.scriptable.app/widgetstack/
