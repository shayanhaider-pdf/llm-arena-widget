# AI Radar v0.9 — Graphite

Configurable Scriptable widgets for iPhone and compatible Apple devices. The Graphite theme uses purple Frontier, mint ChatGPT Plus and blue Free cards. Small and medium show one category; large shows up to five ordered rows, without branding, charts, or footer text. Medium draws rank history only when at least two observations fit the available space; otherwise it shows a decorative accent stripe.

## Install and configure
Paste [AI-Radar.js](AI-Radar.js) into your existing Scriptable script, preserving its name. Run it and choose Refresh published data. Small/medium accept one category parameter: search, work, text, reasoning, writing, vision, documents, webdev, image, editing, video, agent, imagevideo, videoedit, steering, instruction, chatagent.

The default large order is Work capability, Overall text, Documents, Search, Images. From Settings > Edit large categories, choose a row to move up/down, replace or remove it. Add a row when fewer than five are present. Save order or cancel without saving. A saved order takes precedence over an old widget parameter; other existing custom orders are preserved before editing. Coding and mathematics are excluded, with Web Development retained.

Medium and large model cards open provider websites; Work/Codex OpenAI entries route to the respective product pages. Small widgets have one tap target and open the category details. A category label on large opens its rankings. Provider links do not preselect every exact model or mode, and access may depend on account, region and limits.

## Data and access
- [Arena dataset](https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset) supplies ranks. Monthly ingestion pins a single upstream revision, discovers complete latest Parquet shards and validates rows. `data/latest.json` preserves full collected groups; `data/widget.json` publishes the widget's 17 categories. Search remains a partial snapshot until complete official data is obtained.
- Work capability uses `agent_capability:work`, distinct from the website Work Index. Reasoning is the hard-prompts proxy.
- `data/access.json` maintains evidence-linked exact IDs and scopes. Confirmed access takes precedence; if none is confirmed, a candidate marked with ? can appear. A dash means no supported match. Exact benchmark configurations, API-only access, trials and local weights are not assumed to be free consumer access. Local overrides stay on-device.
- Optional `codeModels` holds coding-specific records without invalidating older schema-v1 clients; `models` retains chat/work entries. `plusCandidate` allows a free candidate also to be considered for Plus. The provider's family list is informational, not automatic eligibility.
- [Access audit](data/access-audit.tsv) is the full inventory of model IDs and scopes from the 25 November 2026 published feed, matched to the reviewed registry. Unverified is not the same as paid or unavailable. This inventory is a dated audit, not proof that each provider's login-dependent selector was individually tested.
- GitHub Actions collects the first day of each month at 05:17 UTC or manually. Code changes run read-only checks; failed groups retain their last valid observation. The widget checks published files after a successful daily fetch, or via Refresh published data. Data updates need no reinstall. Code changes require deliberate installation; no remote code execution.

## Engineering checks
Follow [AGENTS.md](AGENTS.md) and the [adapted Ponytail skill](.agents/skills/ponytail/SKILL.md).
```sh
python -m unittest -v test_logic.py
node test_widget.cjs
```
JavaScript tests simulate Scriptable APIs and exercise production feed categories, provider routes, saved row order, compact layout budgets, validation and offline recovery. Native Apple rendering, hit targets and live collection must still be tested on the actual device/workflow.

Sources: https://developer.apple.com/design/human-interface-guidelines/widgets ; https://docs.scriptable.app/widgetstack/ ; https://docs.scriptable.app/urlscheme/
