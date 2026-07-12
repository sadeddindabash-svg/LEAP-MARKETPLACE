# Contributing

## Branching

- `main` — always deployable; protected, merges via PR only
- `develop` — integration branch for the current milestone (optional; adopt if
  the team prefers a staging-before-main flow)
- Feature branches: `feature/<short-description>` (e.g. `feature/vehicle-selector`)
- Fix branches: `fix/<short-description>`
- Release branches (once past Phase 1 MVP): `release/<version>`

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(mobile): add vehicle selector garage screen
fix(api): correct commission calculation rounding
docs: update SRS reference in README
chore(ci): add lint step to pipeline
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.

## Pull requests

- Link the relevant SRS requirement ID(s) (e.g. `BUY-031`, `SUP-011`, `ADM-020`)
  in the PR description so reviewers can trace scope back to requirements.
- Keep PRs scoped to one feature or fix — large multi-area PRs slow review.
- All PRs require at least one approval before merging to `main`.
- CI (see `.github/workflows/ci.yml`) must pass before merge.

## Code review checklist

- [ ] Matches the relevant requirement in `docs/SRS.docx`
- [ ] Matches the UI/UX defined in the relevant prototype under `docs/prototypes/`
  (or the PR explains and justifies the deviation)
- [ ] No secrets or credentials committed
- [ ] Tests added/updated where applicable
- [ ] Bilingual/localization strings added to the translation layer, not hardcoded
  (applies to buyer app and supplier portal work)

## Issue labels (suggested)

`must-have`, `should-have`, `could-have` — mirroring the SRS priority tags —
plus standard `bug`, `enhancement`, `question`, `blocked`.
