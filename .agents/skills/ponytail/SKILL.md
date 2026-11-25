---
name: ponytail
description: Make the smallest complete, verifiable engineering change in this project.
---

# Ponytail, adapted for AI Radar

Inspired by [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail), MIT-licensed upstream. This is a project-specific original adaptation, not a global installation.

- Trace the requested behavior through UI, data, collector, tests, configuration and docs before editing.
- Prefer existing platform capabilities and shared functions. Remove unreachable or redundant paths. Add dependencies only if the required capability cannot reasonably be implemented with existing ones.
- Preserve existing user settings and the last valid data. Never execute downloaded code. Treat external JSON as untrusted.
- Keep source identity, publication date, completeness, and consumer-access evidence separate. Unknown or expired access must remain unknown; never substitute a different benchmark silently.
- For every nontrivial fix, reproduce failure, add a focused regression test, then rerun the entire suite against both fixtures and the checked-in production feed.
- Gate release on correctness, compatibility, data integrity, recovery, security/privacy, maintainability, performance, accessibility, and observability. Report what was actually run and what remains unverified; do not award numerical scores without defined evidence.
- Keep monthly ranking collection independent from code releases; preserve install-once data sync. Avoid unrelated UI changes during a functional audit.
- Prefer concise, readable code over clever compression. Explain material tradeoffs and remaining risks.
