# Persistence foundation: chapters, volumes, and sources

## Goal

Create the first PostgreSQL schema slice for manga chapters, volumes, their localized titles, and official source references. This establishes the identity and publication records needed by later domain slices without implementing API behavior.

## Scope

- Add a Flyway migration for `volume`, `volume_translation`, `chapter`, `chapter_translation`, and `source`.
- Use application-generated UUID primary keys.
- Store localized chapter and volume titles in entity-specific translation tables keyed by owner and canonical BCP 47 locale.
- Keep source chapter and volume references optional and type-safe with foreign keys.
- Enforce the documented positive, unique numbering and enum-value constraints.
- Add the volume-and-number index needed to list a volume's chapters in sequence.
- Verify the migration and constraints against PostgreSQL 18 with Testcontainers.

## Out of scope

- Saga and arc tables or chapter-to-arc assignment. `chapter.arc_id` will be added with the story-structure slice.
- Japanese source-title and romanization metadata. This slice stores localized titles by locale; representation of a documented romanization system belongs to the later localization slice.
- Volume editions, cover stories, SBS entries, and source-to-fact evidence links. Evidence links will be typed associations when their fact tables are added.
- Dataset release metadata, ingestion tooling, seed data, repositories, jOOQ generation configuration, and API routes.
- Temporal fact tables and `btree_gist` exclusion constraints. They are required when the corresponding fact tables are introduced, not for this foundation migration.
- Source-type-specific requirements for whether `chapter_id` or `volume_id` must be present; the approved conceptual model leaves both references optional.

## Requirements

1. `volume.id`, `chapter.id`, and `source.id` are application-generated UUID primary keys with no database-generated defaults.
2. `volume.number` and `chapter.number` are positive, unique integers. Chapter number is the canonical manga sequence coordinate and a unique alternate key; future temporal chapter bounds will reference it by foreign key as recorded in ADR 0003.
3. A chapter may reference at most one volume through nullable `chapter.volume_id`; a volume can contain multiple chapters.
4. `chapter.page_count` is nullable and, when present, positive. `chapter.cover_type` is required and limited to `STANDARD`, `COLOR_SPREAD`, `COVER_STORY`, or `OTHER`.
5. `chapter_translation` and `volume_translation` each have a foreign key to their owning record and a composite primary key of `(owner_id, locale)`. Titles are required. Locale values are canonical BCP 47 tags; fallback copies are not stored.
6. `source.type` is required and limited to `MANGA_CHAPTER`, `SBS`, `VIVRE_CARD`, `DATABOOK`, or `OTHER_OFFICIAL`.
7. `source.chapter_id` and `source.volume_id` are independently nullable foreign keys to the corresponding UUID identifiers. `locator`, `reference_label`, and `publication_date` are nullable. No source text or URL field is introduced.
8. Foreign-key and check constraints reject references to missing records and values outside the documented bounds or enums.
9. Running Flyway against a fresh PostgreSQL 18 database applies the migration once; running it again is a no-op. Testcontainers integration tests verify representative valid inserts and constraint failures.

## Acceptance criteria

- The schema is created only by a versioned Flyway migration; the migration is not edited after merge.
- PostgreSQL integration tests prove volume/chapter/source foreign keys, unique positive numbers, allowed types, and translation uniqueness.
- Chapter and volume titles can coexist in English and Spanish without fallback copies.
- Chapter-to-volume membership queries can retrieve chapters ordered by chapter number using the volume-and-number index.
- No public API contract, domain semantics, or behavior outside this specification changes.
