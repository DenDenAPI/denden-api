# DenDenAPI

DenDenAPI is a multilingual REST API for One Piece data. Prefer correctness, explicit domain modeling, maintainability, and simple solutions over premature abstraction.

## Sources of truth

- Domain knowledge: `docs/domain/`
- Architecture and ADRs: `docs/architecture/` and `docs/architecture/decisions/`
- Feature requirements and acceptance criteria: `specs/`

Read the relevant sources before changing behavior. Never introduce, remove, or reinterpret domain concepts that are not documented. Ask before deciding domain semantics, public API contracts, architecture, data-model strategy, major dependencies, or backwards compatibility.

Small implementation decisions may be made autonomously when they do not affect those areas. Do not invent requirements.

## Stack

- Kotlin on JDK 21 and Gradle Kotlin DSL
- Ktor and Metro
- PostgreSQL, jOOQ, and Flyway
- kotlinx.serialization
- JUnit 5, Ktor test utilities, and Testcontainers
- Docker

Do not introduce GraphQL or another foundational framework in anticipation of future needs. A large or invasive production dependency requires approval.

## Architecture

The Gradle modules are `domain`, `application`, `infrastructure`, and `api`. Dependencies point inward.

- `domain`: pure Kotlin business concepts and rules. No Ktor, Metro, jOOQ, persistence, HTTP, JSON, or serialization concerns.
- `application`: use cases and orchestration. It depends on domain and defines ports needed by use cases.
- `infrastructure`: PostgreSQL access, jOOQ repositories, migrations, persistence mappings, and external adapters. Persistence models never leak inward or into API contracts.
- `api`: Ktor routes, request and response DTOs, HTTP validation and error mapping, serialization, localization resolution, and the Metro dependency graph.

Prefer constructor injection. Define the Metro graph and bindings at the composition boundary. Keep `domain` and `application` independent from the DI framework, and do not use the graph as a service locator.

## API and localization

The public API is REST and JSON, versioned under `/v1`. Update OpenAPI whenever a public contract changes. Never expose persistence models directly.

Return localized values for the requested language rather than every translation. English is the fallback. Keep localization behavior consistent and centralized.

## Database

PostgreSQL is the persistence source of truth. Use jOOQ and explicit SQL-oriented queries rather than ORM abstractions.

Every schema change requires a Flyway migration. Never edit a migration that may already have been applied; add a new one. Verify database behavior against PostgreSQL with Testcontainers when relevant.

## Specifications

Feature work starts from a specification in `specs/` that defines goal, scope, out of scope, requirements, any API contract, and acceptance criteria.

Do not expand a specification silently. If implementation reveals missing or contradictory domain behavior, stop and ask instead of inventing it.

## Testing and completion

Test production behavior at the appropriate boundary:

- domain and application behavior with focused tests;
- persistence and migrations with Testcontainers and real PostgreSQL;
- HTTP contracts, serialization, validation, localization, and error mapping with Ktor test utilities.

Prefer observable behavior over implementation details. Use mocks only when they add clear value; never mock PostgreSQL in a persistence integration test.

Before reporting completion, run every applicable check:

```shell
./gradlew build
./gradlew test
```

Also verify affected migrations, API contracts, OpenAPI, and documentation. Do not claim a check passed unless it was actually run successfully. Report any check that could not run.

## Working principles

- Prefer simple, explicit behavior and existing patterns.
- Avoid speculative abstractions and unrelated refactors.
- Do not implement functionality outside the active specification.
- Clarifying documentation edits are allowed; conceptual changes require approval.
- Record significant approved architecture decisions as ADRs.
- Keep changes focused and use Conventional Commits when committing.
- Write everything stored in the repository in English, including identifiers, comments, tests, documentation, specifications, ADRs, and commit messages.
