# DenDenAPI domain documentation

Status: **proposed domain freeze for v0.1**.

These documents define the product and domain contract that must be reviewed before implementation starts. They intentionally avoid framework, database and deployment choices.

## Reading order

1. [Overview](overview.md) — purpose, boundaries and governing principles.
2. [Domain model](domain-model.md) — entities, relationships and invariants.
3. [Localization](localization.md) — locale resolution and translated content.
4. [Temporal and spoiler model](temporal-spoiler-model.md) — historical truth versus reader-visible truth.
5. [Provenance and data governance](provenance.md) — sources, evidence and editorial rules.
6. [API design](api-design.md) — proposed public resource and query conventions.
7. [v0.1 scope and handoff](v0.1-scope.md) — committed scope, deferred work and implementation gates.

## Decision status

The documents use three labels:

- **Decision**: expected to be implemented unless a later ADR replaces it.
- **Proposal**: a recommended contract that still needs review during the v0.1 freeze.
- **Deferred**: intentionally designed only far enough to avoid closing future options.

After this package is accepted, material changes should be recorded as Architecture Decision Records rather than silently changing the model.
