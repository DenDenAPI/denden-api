# ADR 0001: Kotlin, Ktor, and Clean Architecture

- Status: Accepted
- Date: 2026-09-27

## Context

DenDenAPI needs a maintainable backend for a rich multilingual and spoiler-aware domain. Framework and persistence details must remain at the boundaries so the domain can be modeled explicitly and tested independently.

## Decision

Use Kotlin with Ktor, Koin, PostgreSQL, jOOQ, Flyway, kotlinx.serialization, JUnit 5, Testcontainers, Gradle Kotlin DSL, and Docker.

Organize the backend into four Gradle modules:

- `domain` contains pure Kotlin business concepts and rules;
- `application` contains use cases and defines required ports;
- `infrastructure` implements persistence and external adapters;
- `api` contains Ktor HTTP concerns and the Koin composition root.

Module dependencies point inward. Public API and persistence models remain separate from domain models.

## Consequences

- The build enforces the primary architectural boundaries.
- Ktor, Koin, jOOQ, and serialization concerns stay outside the domain.
- PostgreSQL integration behavior is tested against PostgreSQL through Testcontainers.
- Database schema and jOOQ code-generation strategy remain separate decisions and are not established by this ADR.
