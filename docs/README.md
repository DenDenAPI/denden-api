# DenDenAPI documentation

Status: **domain frozen for v0.1 on 2026-09-27**.

The domain documents define the product contract that must be reviewed before feature implementation. Architecture documentation records approved technical decisions separately from domain meaning.

## Reading order

1. [Overview](domain/overview.md) — purpose, boundaries and governing principles.
2. [Domain model](domain/domain-model.md) — entities, relationships and invariants.
3. [Localization](domain/localization.md) — locale resolution and translated content.
4. [Temporal and spoiler model](domain/temporal-spoiler-model.md) — historical truth versus reader-visible truth.
5. [Provenance and data governance](domain/provenance.md) — sources, evidence and editorial rules.
6. [API design](api-design.md) — proposed public resource and query conventions.
7. [v0.1 scope and handoff](../specs/v0.1-scope.md) — committed scope, deferred work and implementation gates.
8. [Architecture](architecture/README.md) — module boundaries and accepted ADRs.

## Decision status

The documents use three labels:

- **Decision**: expected to be implemented unless a later ADR replaces it.
- **Proposal**: a recommended contract that still needs review during the v0.1 freeze.
- **Deferred**: intentionally designed only far enough to avoid closing future options.

The package is accepted for v0.1. Material domain changes require explicit approval. Significant technical decisions should be recorded as Architecture Decision Records.
