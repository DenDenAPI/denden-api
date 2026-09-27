# ADR 0001: Kotlin, Ktor, and Clean Architecture

- Status: Accepted
- Date: 2026-09-27

## Context

DenDenAPI needs a maintainable backend for a rich multilingual and spoiler-aware domain. Framework and persistence details must remain at the boundaries so the domain can be modeled explicitly and tested independently.

## Decision

Use Kotlin on JDK 21 with Ktor, Metro, PostgreSQL, jOOQ, Flyway, kotlinx.serialization, JUnit 5, Testcontainers, Gradle Kotlin DSL, and Docker.

Organize the backend into four Gradle modules:

- `domain` contains pure Kotlin business concepts and rules;
- `application` contains use cases and defines required ports;
- `infrastructure` implements persistence and external adapters;
- `api` contains Ktor HTTP concerns and the Metro dependency graph.

Module dependencies point inward. Public API and persistence models remain separate from domain models.

## Consequences

- The build enforces the primary architectural boundaries.
- Ktor, Metro, jOOQ, and serialization concerns stay outside the domain.
- Metro validates and generates the dependency graph at compile time without KSP or KAPT.
- JDK 21 is the build and runtime baseline required by the Metro Gradle plugin.
- PostgreSQL integration behavior is tested against PostgreSQL through Testcontainers.
- Database schema and jOOQ code-generation strategy remain separate decisions and are not established by this ADR.
