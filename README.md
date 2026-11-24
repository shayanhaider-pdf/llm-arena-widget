# LLM Arena widget (v0.2)

Configurable Scriptable widgets for iPhone/iPad and compatible Macs. Small and medium show one category without trend markers; large shows up to five categories with seven-day movement. No branding or daily-refresh footer.

## Install
1. Install Scriptable from the App Store. Create a script named AI Radar, paste [AI-Radar.js](AI-Radar.js), and run it.
2. Add a Scriptable widget and choose that script. Set its Parameter to search, reasoning, writing, vision, documents, text, webdev, image, editing, video, or agent. For a large widget use a comma-separated list of up to five, or leave blank to use saved defaults. Coding and mathematics are excluded; web development remains its own category. Reasoning maps to Arena Hard Prompts.
3. Tap the gear on medium/large widgets to open settings, or tap anywhere on small widgets for category details and settings. In category details choose a model to open or edit its destination, display name and eligibility. A custom HTTPS URL opens directly from medium/large cells. Small widgets have only one tap target.
4. For compatible Macs, enable System Settings > Desktop & Dock > Widgets > Use iPhone widgets.

## Data and privacy
The default feed is the public repository's data/latest.json when available; direct Arena dataset retrieval is the fallback. Enable Actions and run the refresh workflow manually once. Apple controls widget refresh timing. Seven-day indicators on large compare the same model's official rank against the snapshot observed seven UTC calendar days earlier: green up, red down, gray dash for equal, blank for missing history. No artificial history. Stale data is identified in the header when relevant.

Exact Arena IDs determine Plus/free eligibility. No personal settings are uploaded. Unknown access is excluded. The public feed contains rankings only. Configure custom links through settings, not by editing repository files.

## Validation
Run `python -m unittest test_logic.py`. Prototype: device rendering, live data and GitHub Actions require validation. The model access registry starts empty by design.

Sources: https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset ; https://docs.scriptable.app/widgetstack/
