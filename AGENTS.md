# AI Radar development instructions

Use the repository's [adapted Ponytail skill](.agents/skills/ponytail/SKILL.md) for coding, debugging, reviews and release decisions. Read it before making changes.

## Validation
Run `python -m unittest -v test_logic.py` and `node test_widget.cjs`. CI must run both on pull requests. The JavaScript suite uses simulated Scriptable APIs, not an Apple runtime. A successful suite does not establish native rendering or live source access. Keep the production data fixture checks separate from synthetic edge-case tests.

## Release policy
Keep published rankings and eligibility data backward compatible, never expose personal overrides, never download and execute remote scripts, and do not publish fabricated or silently relabeled ranks. If live or native verification is missing, record it explicitly. Preserve the monthly schedule and current visual design unless explicitly requested otherwise.
