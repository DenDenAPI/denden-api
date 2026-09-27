# Persistence design proposal

## Status

Proposal for review. This document does not select a persistence strategy, define a relational schema, or authorize migrations or endpoint implementation.

## Goal

Identify the persistence decisions needed to implement the approved v0.1 domain and proposed v1 API without weakening the documented identity, localization, temporal, spoiler, or provenance rules.

## Constraints from approved documentation

- PostgreSQL is the persistence source of truth; jOOQ and Flyway are in the approved stack.
- The conceptual domain model is not a relational schema. Storage details remain undecided.
- First-class resources have opaque, immutable IDs and stable, non-localized slugs where applicable. Chapter references must resolve to chapters.
- Localized content is separate from identity. Character names have their own type, history, visibility and translations.
- Changing facts are historical records with independent validity and reader-availability chapter axes.
- Important facts and relationships may have multiple evidence sources. Prefer type-safe evidence associations where practical.
- Persistence models stay inside `infrastructure`; use cases depend on application-owned ports.
- Schema changes require additive Flyway migrations; applied migrations are immutable.

## Relational representation options

### A. Typed relational tables

Give entities, translations, relationships, historical facts and evidence associations explicit tables and foreign keys. Use domain-specific columns and constraints for each fact type.

**Advantages:** Strong referential integrity; clear SQL; supports temporal queries and typed evidence; aligns with the conceptual model and PostgreSQL/jOOQ stack.

**Costs:** More tables and migrations; query and mapping work is explicit; some cross-cutting invariants may need application validation or carefully designed database constraints.

### B. Generic fact or entity tables

Represent many kinds of facts or entities through shared tables with type discriminators and generic value/subject fields.

**Advantages:** Fewer table definitions for highly uniform operations; potentially convenient for generic ingestion tooling.

**Costs:** Weaker ordinary foreign keys and constraints; more runtime interpretation; temporal and source associations become less type-safe; risks turning documented concepts into an implicit schema language.

### C. Relational core with JSONB payloads

Keep identity and selected relationships relational while placing variable attributes or fact payloads in JSONB.

**Advantages:** Flexible for irregular source data and evolving editorial metadata.

**Costs:** Harder to constrain, query and generate strongly typed access; can duplicate domain rules in application code; unclear boundary between structured domain facts and unstructured editorial data.

### Candidate for approval

Option A appears most consistent with the current domain documentation: explicit typed tables for public resources, translations, relationships, historical facts and typed evidence links. This is a proposal only. Approval is required before treating it as the data-model strategy or writing migrations. Any JSONB use should be separately limited to fields whose structure is intentionally not part of the domain contract.

## Cross-cutting design questions

### Identifier representation

The domain requires opaque stable IDs, while the API contract represents IDs as strings. The `char_01H...` example in localization documentation is illustrative, not a committed format.

Options to decide:

- PostgreSQL UUID values, serialized as strings;
- prefixed opaque strings, stored as text;
- another representation with explicit generation and public stability rules.

Decide generation ownership (database or application), whether IDs are ever exposed before publication, and how existing IDs survive data imports. Do not infer an ID format from examples.

### Chapter references and temporal facts

The conceptual model requires chapter references to resolve to `Chapter`; the API accepts chapter numbers. A schema can use internal chapter IDs for foreign keys while retaining the unique canonical chapter number as a lookup key. The exact internal ID strategy remains open.

Fact tables need to preserve nullable/unknown validity boundaries separately from required `availableFromChapter` where spoiler-sensitive. Inclusive interval semantics, no-overlap rules for single-valued facts, and membership/role consistency are documented domain invariants. Decide which are enforceable with PostgreSQL constraints and which require application/editorial validation. Do not collapse the two chapter axes or store derived values as authoritative facts.

### Localization

The documented translation pattern suggests a separate translation table keyed by owner and canonical BCP 47 locale. Character names specifically require `CharacterName` and `CharacterNameTranslation` because translation belongs to a historically and spoiler-qualified name record.

Decide whether all other localized fields share a common table shape or use entity-specific translation tables. In either case, enforce uniqueness for one translation per owner and locale, and keep fallback resolution in the API/application projection rather than persisting fallback copies. This proposal does not determine how Japanese original text and romanization are represented.

### Provenance associations

The conceptual model prefers type-safe associations over a polymorphic `(subject_type, subject_id)` reference. Candidate design: each fact/relationship type that carries evidence has a corresponding evidence-link table with a foreign key to `Source`, and a role if the approved model needs it.

This is more explicit but increases table count. Confirm whether the `PRIMARY` / `SUPPORTING` / `CONTRADICTING` roles and editorial notes shown as a future conceptual extension are needed for v0.1 before adding them to a schema.

### jOOQ code generation

The approved stack includes jOOQ, but the code-generation strategy is explicitly undecided in ADR 0001. Options:

- generate jOOQ types from the migrated PostgreSQL schema, using a reproducible local/CI database;
- generate from migration DDL without starting PostgreSQL, if the selected tooling can faithfully model the schema;
- use jOOQ's DSL without generated schema types.

Review criteria: schema is the single source of truth, generated output is reproducible, CI verifies it cannot drift, and developers can build/test without undocumented manual setup. Select tooling and generated-source policy only after deciding the migration workflow.

## Suggested decision sequence

1. Approve the relational representation strategy and ID representation.
2. Agree which invariants belong in PostgreSQL constraints versus application/editorial validation.
3. Agree translation and evidence-link table conventions.
4. Select migration-driven jOOQ generation and local/CI workflow.
5. Draft and review an initial schema against every v0.1 entity, relationship, temporal fact, localization case and v1 read projection.
6. Only then add the initial Flyway migration and persistence implementation specification.

## Explicitly out of scope

- Creating or changing database migrations, tables, indexes, constraints, or generated sources.
- Adding dependencies or Gradle plugins.
- Implementing repositories, data import, API endpoints, or runtime database behavior.
- Deciding hosting, deployment, sharding, partitioning, caching, or multi-continuity storage.

## Review questions

1. Approve or reject typed relational tables as the persistence direction; if rejecting, which option should be explored?
2. Which opaque ID representation should the project use, and who generates IDs?
3. Should localized fields other than character names use entity-specific translation tables or a common translation table pattern?
4. Should v0.1 evidence links include evidence roles/editorial notes, or only source associations?
5. Should jOOQ types be generated from a PostgreSQL database migrated by Flyway, and should generated sources be committed or recreated during builds?
6. Are the proposed decision sequence and explicit scope exclusions correct?
