# LLM Arena widget (v0.5)

Configurable Scriptable widgets for iPhone/iPad and compatible Macs. Small and medium show one category without trend markers; large shows up to five categories with seven-day movement. No branding or daily-refresh footer.

## Install
1. Install Scriptable from the App Store. Create a script named AI Radar, paste [AI-Radar.js](AI-Radar.js), and run it.
2. Add a Scriptable widget and choose that script. Set its Parameter to search, reasoning, writing, vision, documents, text, webdev, image, editing, video, or agent. For a large widget use a comma-separated list of up to five, or leave blank to use saved defaults. Coding and mathematics are excluded; web development remains its own category. Reasoning maps to Arena Hard Prompts.
3. Tap the gear on medium/large widgets to open settings, or tap anywhere on small widgets for category details and settings. Tap a model to open the recognized provider’s chat website automatically. Medium and large cells open directly; small widgets have one tap target and open the model-selection list. Unrecognized or unavailable provider destinations fall back to Arena. The website may require login and may not offer the exact ranked model.
4. For compatible Macs, enable System Settings > Desktop & Dock > Widgets > Use iPhone widgets.

## Data and privacy
The widget reads the repository feed, then requests the official Arena dataset directly for a missing, partial or stale category (bounded requests). A dated, partial Search starter snapshot from Arena's November 20, 2026 leaderboard is included until a full automatic refresh succeeds. Search uses the raw model leaderboard; the style-controlled variant remains in the feed for old scripts. Apple controls widget refresh timing. Seven-day indicators on large compare the same model's official rank against the snapshot observed seven UTC calendar days earlier: green up, red down, gray dash for equal, blank for missing history. No artificial history. Stale data is identified in the header when relevant.

Exact Arena IDs determine Plus/free eligibility. No personal settings are uploaded. Unknown access is excluded. The public feed contains rankings only. Set Plus/free eligibility through settings. Manual URL entry has been removed; previously saved custom URLs are ignored.

## Validation
Run `python -m unittest -v test_logic.py` and `node test_widget.cjs`. Both suites gate the scheduled collector. The v0.5 widget suite passed 54 mocked-runtime assertions, including provider routing, ignored legacy URL overrides and first launch without GitHub data. The live API and scheduled workflow have not been verified from this environment. Live API connectivity and native device rendering still require validation. The model access registry starts empty by design.

Sources: https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset ; https://docs.scriptable.app/widgetstack/
