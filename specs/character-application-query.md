# Character application query

## Goal

Define the application boundary and `GetCharacter` use case for loading a character's name and status history by stable slug and producing the approved temporal/spoiler projection.

## Scope

- Define an application-layer aggregate containing one `Character` and its name and status records.
- Define a read port that loads the aggregate by stable non-localized slug.
- Add a use case that returns no result when the port finds no character.
- Delegate character fact selection to the domain `CharacterProjectionEngine` using the supplied `ProjectionContext`.
- Keep the application component synchronous and free of framework, persistence, HTTP, serialization, and localization concerns.

## Out of scope

- PostgreSQL or jOOQ adapters and generated schema types.
- Transactions, connection pools, coroutine dispatchers, or caching.
- Public routes, DTOs, HTTP validation, error mapping, or `404` behavior.
- Locale negotiation and translation selection.
- Deciding whether a persisted character without a visible primary name is hidden as an entire public resource.
- Character collection queries, pagination, filters, includes, or sorting.
- Character facts beyond names and status.

## Requirements

1. The read port is defined in `application` and depends only on domain models.
2. The port accepts one non-blank stable slug and returns either a complete character/name/status aggregate or no result.
3. The use case passes the requested slug to the port without localization or persistence-specific transformation.
4. No persisted character produces no application projection.
5. A loaded aggregate is projected with the exact supplied temporal/spoiler context.
6. Domain validation remains authoritative for ownership, overlap, temporal validity, and spoiler availability.
7. Domain invariant failures propagate rather than being translated into transport-specific errors.
8. The use case uses constructor injection and remains independent from Metro or any service locator.

## Acceptance criteria

- Unit tests prove that the requested slug is passed to the port.
- Unit tests prove that a missing character returns no result.
- Unit tests prove that the use case returns the domain projection for a loaded aggregate.
- Unit tests prove that the supplied `asOfChapter` and `maxChapter` affect the result.
- Unit tests prove that blank slugs are rejected before the port is called.
- Unit tests prove that domain invariant failures are not swallowed.
- No schema, infrastructure adapter, public API, or localization behavior changes.
