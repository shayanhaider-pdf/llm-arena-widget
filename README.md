# AI Radar

AI Radar compares Arena’s highest-ranked model, the best reviewed ChatGPT Plus option, and the best reviewed free option for a task. It offers 23 categories, including Search, Documents, Work, and Image Generation.

## Native iPhone and iPad widget

The [native WidgetKit project](native/README.md) uses iOS’s **Edit Widget** picker. Small and medium widgets each choose one category. Large boards choose up to five ordered rows. Each widget’s selection belongs to that widget, and all sizes read the same monthly ranking feed. See the guide for Xcode installation, migration from Scriptable, and the device verification checklist.

## Scriptable v0.14 — Graphite

The Scriptable version runs on iPhone and compatible Apple devices. The Graphite theme uses purple Frontier, mint ChatGPT Plus and blue Free cards. Small and medium show one category. Large shows up to five ordered rows. Medium draws rank history when at least two observations fit the available space.

### Home Screen appearance
The default Glass-safe appearance avoids opaque inner fills and borders, which can become white and obscure text under iOS Clear or Tinted rendering. In Scriptable, Settings > Card appearance allows opting into the original filled Graphite cards for standard Light/Dark Home Screens. The safe layout preserves the same ranking data, dimensions and navigation, but omits the chart and solid inner backgrounds. Scriptable does not expose WidgetKit's rendering mode to the script, so this is an explicit setting rather than automatic detection. Native tinted rendering still requires an on-device check; simulated tests verify the absence of offending fills, not Apple's compositor.

### Install and configure
Paste [AI-Radar.js](AI-Radar.js) into your existing Scriptable script, preserving its name. Run it and choose Refresh published data. For small/medium, leave Parameter empty and use Change widget category from the widget's settings. Each size has its own saved default. Tap the small widget and choose Change widget category from the four-action menu (Change widget category, Open model, View full rankings, Settings); tap the medium gear and choose Change widget category. From the standalone script menu, choose Change widget category, then size and profile. For multiple independent widgets of the same size, set a different one-time parameter (slot:2 through slot:9) and then use the same picker. Widgets of the same size and profile share their category. Previously typed category parameters remain fixed; clear Parameter once to enable the default picker. The selected categories are stored locally in widget-categories.json. Home Screen changes appear when iOS next refreshes the widget; small/medium request a refresh after 30 minutes, not a guaranteed interval.

Fixed category parameters remain supported: agent, alignment, work, coding, chatagent, taskoutcome, steering, tooluse, text, search, vision, documents, webdev, imagewebdev, image, editing, multiedit, video, imagevideo, videoedit, reasoning, writing, instruction.

Settings groups categories under Agent, Chat, Code, Image, Video, and Text specialties. Choose Preview widget to open Scriptable's native Small, Medium or Large preview without changing saved settings. The default large order is Work capability, Overall text, Documents, Search, Images. From Settings > Edit large categories, choose a row to move up/down, replace or remove it. Add a row when fewer than five are present. Save order or cancel without saving. A saved order takes precedence over an old widget parameter; other existing custom orders are preserved before editing. Agent Coding and Web Development are available independently. Mathematics remains excluded.

Medium and large model cards open provider websites; Work/Codex OpenAI entries route to the respective product pages. Small widgets have one tap target and open a compact native action sheet. Rankings are shown only on explicit request, and Open model offers up to three model options. A category label on large opens its rankings. Provider links do not preselect every exact model or mode, and access may depend on account, region and limits.

## Data and access
- [Arena dataset](https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset) supplies ranks. Monthly ingestion pins a single upstream revision, discovers complete latest Parquet shards and validates rows. `data/latest.json` preserves full collected groups. `data/widget.json` publishes 23 categories (all 20 sidebar entries plus Reasoning, Creative Writing, and Instruction Following). Search uses all 45 published models from the official dataset. Alignment uses all 68 ranked display names from the official November 24, 2026 website snapshot. The website list lacks exact variant IDs for consumer-access matching.
- Agent Work, Coding and Chat use separate `agent_capability` groups; Task Outcome, Steering and Tool Use use their respective official datasets. Reasoning is the hard-prompts proxy. Single Image Edit and Multi Image Edit remain separate, as do WebDev and Image-to-WebDev.
- `data/access.json` maintains evidence-linked exact IDs and scopes. Confirmed access takes precedence; if none is confirmed, a candidate marked with ? can appear. A dash means no supported match. Exact benchmark configurations, API-only access, trials and local weights are not assumed to be free consumer access. Local overrides stay on-device.
- Optional `codeModels` holds coding-specific records without invalidating older schema-v1 clients; `models` retains chat/work entries. `plusCandidate` allows a free candidate also to be considered for Plus. The provider's family list is informational, not automatic eligibility.
- [Access audit](data/access-audit.tsv) records model IDs and scopes from the November 25, 2026 baseline, before the Search and Alignment expansions. Many exact variants still need consumer-access evidence.
- GitHub Actions collects the first day of each month at 05:17 UTC or manually. Code changes run read-only checks; failed groups retain their last valid observation. The widget checks published files after a successful daily fetch, or via Refresh published data. Data updates need no reinstall. Code changes require deliberate installation; no remote code execution.

## Engineering checks
Follow [AGENTS.md](AGENTS.md) and the [adapted Ponytail skill](.agents/skills/ponytail/SKILL.md).
```sh
python -m unittest -v test_logic.py
node test_widget.cjs
```
JavaScript tests simulate Scriptable APIs and exercise all 23 production feed categories on three representative iPhone screen sizes, nested horizontal and vertical layout budgets, grouped navigation, native preview routes, provider routes, saved row order, validation and offline recovery. The test harness does not measure native font glyphs, truncation, or actual Apple rendering. Native Apple rendering, hit targets and live collection must still be tested on the actual device/workflow.

Sources: https://developer.apple.com/design/human-interface-guidelines/widgets ; https://docs.scriptable.app/widgetstack/ ; https://docs.scriptable.app/urlscheme/
