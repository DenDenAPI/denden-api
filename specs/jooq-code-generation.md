# jOOQ code generation

## Goal

Generate type-safe jOOQ schema classes reproducibly from the real PostgreSQL schema produced by the repository's Flyway migrations.

## Scope

- Use the official jOOQ Gradle code-generation plugin aligned with the runtime jOOQ version.
- Start an ephemeral PostgreSQL 18 database through Testcontainers for generation.
- Apply every Flyway migration to that database before jOOQ introspection.
- Generate Java schema and record types under the infrastructure build directory.
- Connect Kotlin and Java compilation to code generation.
- Treat migration files as generation inputs and generated sources as task outputs.
- Verify representative generated tables and temporal fields through a focused test.

## Out of scope

- Committing generated sources.
- Runtime connection-pool configuration or a production database.
- Character repository queries or persistence mappings.
- Public API, application, or domain behavior changes.
- Generating jOOQ DAOs or POJOs.
- Reusing long-lived Testcontainers instances between builds.

## Requirements

1. The build uses `org.jooq.jooq-codegen-gradle` version `3.19.38`, matching the runtime jOOQ dependency.
2. Code generation introspects PostgreSQL 18 rather than an emulated or parsed SQL dialect.
3. The generation database is disposable and starts from an empty schema.
4. Flyway applies the repository's versioned migrations before jOOQ reads the schema.
5. The generation database remains alive for the complete jOOQ connection lifecycle and stops when the generator closes its connection.
6. Generated code uses package `com.dendenapi.infrastructure.jooq` and is written below `infrastructure/build/generated-src`.
7. Generated code is a build output and remains excluded by the existing `**/build/` ignore rule.
8. The generator excludes Flyway's schema-history table.
9. Schema classes and records are generated; jOOQ POJOs and DAOs are not generated.
10. Infrastructure compilation depends on code generation so a clean checkout can build without pre-generated files.
11. Migration files are declared as generation inputs and the generated directory as output for Gradle up-to-date checks.
12. The generation helper is build-only and never becomes a production runtime dependency.

## Acceptance criteria

- Removing `infrastructure/build` and running `./gradlew build` regenerates and compiles the jOOQ types.
- Generated sources include all application tables created by the current Flyway migrations.
- Generated character-name and status tables expose validity ranges and temporal chapter fields.
- No generated source is tracked by Git.
- `./gradlew build` and `./gradlew test` pass with PostgreSQL 18 available through Docker.
- No domain, application, persistence-query, or public API behavior changes.
