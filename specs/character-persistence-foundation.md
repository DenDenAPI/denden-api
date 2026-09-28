# Character persistence foundation

## Goal

Create the PostgreSQL schema slice for character identity, localized historical names, historical status, and typed source evidence.

## Scope

- Add a Flyway migration for `character`, `character_name`, `character_name_translation`, `character_status_record`, and typed source link tables.
- Keep character identity separate from localized and historical facts.
- Store temporal chapter references against the canonical `chapter.number` alternate key.
- Enforce inclusive interval ordering and PostgreSQL exclusion constraints for primary names and status records.
- Store name translations by canonical locale without fallback copies.
- Associate names and status records with sources through explicit typed many-to-many tables.
- Verify the migration and constraints against PostgreSQL 18 with Testcontainers.

## Out of scope

- Character gender, birthday, age, height, race, location, organization, bounty, Devil Fruit, or Haki records.
- Public routes, DTOs, repositories, jOOQ generation, or application use cases.
- Resource-level spoiler visibility and recursive response projection.
- Seed data or ingestion tooling.
- Enforcing publication completeness, including the editorial rule that published important facts have at least one official source. The schema provides typed evidence associations; publication validation belongs to the later ingestion workflow.
- Slug redirects or correction history.

## Requirements

1. Every table introduced by this slice is created through a new additive Flyway migration.
2. `character.id`, `character_name.id`, and `character_status_record.id` are application-generated UUID primary keys with no database-generated defaults.
3. `character.slug` is required, non-empty, and unique. It is stable and non-localized.
4. `character.first_mention_chapter_id` and `character.first_appearance_chapter_id` are independently optional foreign keys to `chapter.id`.
5. `character_name.type` is limited to `PRIMARY`, `ALIAS`, or `EPITHET`.
6. Character name validity bounds are optional, inclusive chapter-number foreign keys. `available_from_chapter` is required and references `chapter.number` independently.
7. Known character name bounds satisfy `valid_to_chapter >= valid_from_chapter`.
8. Primary names for the same character cannot have overlapping validity intervals. Alias and epithet intervals may overlap.
9. `character_name_translation` has one required value per character name and locale, keyed by `(character_name_id, locale)`.
10. `character_status_record.status` is limited to `ALIVE`, `DEAD`, or `UNKNOWN`.
11. Character status validity and availability follow the same chapter-reference and interval-order rules as character names.
12. Status records for the same character cannot have overlapping validity intervals.
13. Unknown validity bounds map to unbounded PostgreSQL range endpoints and therefore conservatively participate in overlap checks.
14. `character_name_source` and `character_status_record_source` use composite primary keys and foreign keys to their typed fact and `source` records.
15. The migration enables PostgreSQL's supplied `btree_gist` extension before creating the exclusion constraints.

## Acceptance criteria

- A fresh PostgreSQL 18 database applies both migrations, and a repeated Flyway run is a no-op.
- Integration tests prove character slug uniqueness and chapter foreign keys.
- English and Spanish translations can coexist for one character name, while a duplicate locale is rejected.
- Integration tests prove allowed name types and status values.
- Integration tests prove interval ordering, primary-name non-overlap, status non-overlap, and conservative unknown bounds.
- Integration tests prove aliases may overlap and typed evidence associations preserve foreign-key integrity.
- No public API shape, domain semantics, repository, or application behavior changes.
