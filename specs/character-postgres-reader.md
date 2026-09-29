# PostgreSQL character reader

## Goal

Implement the infrastructure adapter for the application `CharacterReader` port using generated jOOQ types and the approved PostgreSQL schema.

## Scope

- Find a character by its stable slug.
- Load all stored character names, their translations and typed source identifiers.
- Load all stored status records and their typed source identifiers.
- Map generated jOOQ records into the application aggregate and pure domain types.
- Return `null` when the character slug is not present.
- Verify mappings and absence behavior against PostgreSQL 18 with Testcontainers.

## Out of scope

- DataSource, HikariCP, jOOQ `DSLContext`, or Metro production wiring.
- HTTP routes, API DTOs, localization resolution, or resource visibility.
- Applying temporal or spoiler filters in SQL. The domain projection engine remains responsible for those rules.
- Character writes, seed data, source bibliographic expansion, or pagination.
- Character profile facts beyond names and status.

## Requirements

1. The adapter implements the `application`-owned `CharacterReader` port.
2. jOOQ generated schema and record types are used for all queried tables and columns; raw SQL and JDBC are not used by the adapter.
3. The character lookup is by exact stable slug and returns no result for a missing character.
4. The returned aggregate contains every stored name and status record for that character, including facts hidden under a particular projection context.
5. Name translations are returned as a locale-to-value map without fallback copies or locale selection.
6. Name and status source associations are returned as source UUID sets.
7. Temporal chapter coordinates are mapped to `ChapterNumber`, and all fields map without changing their meanings.
8. Name and status records are returned in deterministic order by availability chapter and UUID, so repeated reads of unchanged data produce stable collection order.
9. Database enum strings map to their documented domain enums. Unexpected values fail visibly rather than being dropped.
10. Persistence implementation types remain in `infrastructure` and do not leak through the application port.
11. PostgreSQL integration tests verify the reader against the migrated schema.

## Acceptance criteria

- Integration tests verify a missing slug returns `null`.
- Integration tests verify character identity and first mention/appearance chapter UUIDs.
- Integration tests verify primary, alias, and epithet types, nullable validity bounds, availability chapter, translations, and source identifiers.
- Integration tests verify status enum, temporal fields, and source identifiers.
- Integration tests prove the reader returns the complete history; temporal and spoiler filtering remain the domain engine's responsibility.
- `./gradlew build` and `./gradlew test` pass with jOOQ generation and PostgreSQL 18 available through Docker.
- No schema migration, domain semantics, or public API contract changes.
