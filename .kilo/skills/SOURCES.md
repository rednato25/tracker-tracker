# Project design skills

These four skills are installed at project scope under `.kilo/skills/`, next
to the project's agent configuration. They are the only skills from these
repositories that were vendored; the rest of each repository was not copied.

| Skill                   | Upstream repository                         | Source commit                              | Upstream path                  |
| ----------------------- | ------------------------------------------- | ------------------------------------------ | ------------------------------ |
| `break-ui`              | https://github.com/emilkowalski/skills      | `a81dbca07f2217b7103e510c0f13f8d5b017afc9` | `skills/break-ui`              |
| `mobile-native`         | https://github.com/emilkowalski/skills      | `a81dbca07f2217b7103e510c0f13f8d5b017afc9` | `skills/mobile-native`         |
| `emil-design-eng`       | https://github.com/emilkowalski/skills      | `a81dbca07f2217b7103e510c0f13f8d5b017afc9` | `skills/emil-design-eng`       |
| `web-design-guidelines` | https://github.com/vercel-labs/agent-skills | `1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62` | `skills/web-design-guidelines` |

Fetched 2026-10-28. The three Emil Kowalski skills are MIT-licensed; the license
text is in `.kilo/skills/LICENSE-emilkowalski.txt` (Copyright (c) 2026 Emil
Kowalski). The Vercel repository does not include a license file, so no license
was copied; `web-design-guidelines` fetches the current rules from
`vercel-labs/web-interface-guidelines` when the skill runs.

`break-ui/CATALOG.md` is part of that skill and is required by its `SKILL.md`.
