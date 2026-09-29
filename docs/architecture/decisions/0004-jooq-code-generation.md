# ADR 0004: jOOQ code generation from migrated PostgreSQL

- Status: Accepted
- Date: 2026-09-28

## Context

The persistence strategy requires generated jOOQ schema types to reflect the Flyway-managed PostgreSQL schema. Generation must be reproducible in local development and CI, generated sources must remain build outputs, and PostgreSQL-specific features such as range columns and exclusion constraints must not be approximated through another database dialect or a static SQL parser.

## Decision

- Use the official `org.jooq.jooq-codegen-gradle` plugin introduced in jOOQ 3.19, aligned with the project's jOOQ runtime version.
- Start a disposable PostgreSQL 18 database through Testcontainers when generation is required and stop it when generation closes its connection.
- Initialize that database by running the repository's Flyway migrations before jOOQ introspection.
- Generate schema and record classes into the infrastructure module's build directory and do not commit them.
- Make infrastructure compilation depend on generation and declare migration inputs plus generated outputs for Gradle up-to-date checks.
- Keep the Testcontainers/Flyway initialization helper on a build-only source set. It is not part of the production runtime.
- Generate schema classes and records only. Do not generate DAOs or persistence POJOs; infrastructure adapters map jOOQ records explicitly to application and domain types.

## Consequences

- Clean local and CI builds require Docker when jOOQ output is not already up to date.
- Generated types always describe a schema that PostgreSQL accepted after applying every migration.
- Migration changes invalidate generation automatically.
- Production artifacts do not include Testcontainers or the generation helper.
- Infrastructure repositories can use compile-time checked tables and fields without leaking generated types across the application boundary.

## References

- [PostgreSQL persistence strategy](0002-postgresql-persistence-strategy.md)
- [jOOQ Gradle code generation](https://www.jooq.org/doc/3.19/manual/code-generation/codegen-execution/codegen-gradle/)
- [Testcontainers JDBC support](https://java.testcontainers.org/modules/databases/jdbc/)
- [jOOQ code-generation specification](../../../specs/jooq-code-generation.md)
