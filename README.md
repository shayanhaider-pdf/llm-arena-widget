# LLM Arena widget (v0.8 audit candidate)

Configurable Scriptable widgets for iPhone/iPad and compatible Macs. Small and medium show one category without trends; large shows up to five categories with month-on-month movement. The visual layout is unchanged in this functional release.

## Install and maintain
Create a Scriptable script named AI Radar and paste [AI-Radar.js](AI-Radar.js) once for this release. Add a Scriptable widget using the script. Set Parameter to one of search, work, text, reasoning, writing, vision, documents, webdev, image, editing, video, agent, imagevideo, videoedit, steering, instruction, chatagent. Large accepts up to five comma-separated categories or saved defaults. Coding and mathematics are excluded; Web Development remains separate.

The data and model-access files update independently from the installed code. The widget checks both published files once per UTC day following successful checks, or immediately via Settings > Refresh published data. Apple controls widget refresh timing. Code changes still require deliberate installation; remote code is never executed.

Medium/large model taps open provider chat sites. Small widgets open category details because iOS permits one tap destination. Tap Settings to browse top 20, edit category selection or override access. Unknown models fall back to Arena. Opening a provider does not guarantee access to the exact benchmark configuration.

## Data and provenance
- [Official Arena dataset](https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset) (CC BY 4.0) supplies ranks. Monthly collector pins a single upstream revision, discovers complete latest Parquet shards and validates rows. `data/latest.json` preserves full collected groups; `data/widget.json` contains the widget's 17 groups and full available ranks. Search's current partial snapshot is retained until an official replacement passes validation.
- Work capability uses `agent_capability:work`, not the separate website Work Index. Reasoning uses `text_style_control:hard_prompts`, a proxy rather than a dedicated reasoning score.
- `data/access.json` is the separately reviewed consumer entitlement registry. Exact Arena model/effort and chat/work scope must match. Expired, stale and unconfirmed access is not presented as confirmed; candidates carry a verification marker. Local overrides stay on the device. A free provider plan is not proof of access to every model.
- GitHub Actions collects on the first day of each month, 05:17 UTC, or manual dispatch. Code pushes and pull requests run checks without collecting rankings. Failed groups retain prior valid data with their original observation date. The workflow requires every widget group to be present and valid before publishing both JSON files together.
- Weekly arrows were replaced with month-on-month movement, based on the last observed ranking in the previous calendar month; no history means no marker.

## Engineering checks
Follow [AGENTS.md](AGENTS.md) and the [adapted Ponytail skill](.agents/skills/ponytail/SKILL.md). Run:
```sh
python -m unittest -v test_logic.py
node test_widget.cjs
```
The JS suite uses simulated Scriptable APIs plus the real checked-in ranking and access files. It is not native iOS testing. Native navigation, rendering and scheduled live collection of the new collector must still be validated before declaring the release production-ready.

Sources: https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset ; https://docs.scriptable.app/widgetstack/
