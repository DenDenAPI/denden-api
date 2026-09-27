# Proposed v1 API contract

## Status

This is a proposal for review. The machine-readable OpenAPI document is [`../openapi/openapi.yaml`](../openapi/openapi.yaml). No public domain endpoints are implemented yet.

## Goal

Define the first versioned, read-only REST and JSON contract for the approved v0.1 domain. A client must be able to request localized, temporally selected, spoiler-safe projections and inspect compact official source references.

## Scope

- `GET /v1/meta` for dataset and API metadata.
- Collection reads for characters, organizations, races, locations, Devil Fruits, sagas, arcs, chapters, volumes, and cover stories.
- Detail reads for characters, organizations, races, locations, Devil Fruits, sagas, arcs, chapters, volumes, and cover stories.
- `GET /v1/sources/{id}` for a compact source reference.
- Language selection with `lang` taking precedence over `Accept-Language`, exact locale then base language then English field fallback, and `Content-Language` listing locales used.
- `asOfChapter` and `maxChapter` filtering applied recursively to projections, includes, and derived values.
- Cursor pagination with a default limit of 20 and maximum of 100.
- Bounded includes for character and organization detail/collection routes.
- Bounded `chapters` and `editions` includes for volumes and `episodes` include for cover stories.
- A stable problem response for invalid requests, missing or spoiler-hidden resources, rate limits, and server failures.

## Out of scope

- Write operations, authentication, authorization, or moderation workflows.
- Full-text search, arbitrary graph traversal, or unrestricted field selection.
- Persistence schema, migrations, SQL strategy, hosting, or deployment.
- Anime, film, game, filler, and other continuity endpoints.
- Reproduction of chapter pages, long passages, or full supplementary source text.

## Requirements

1. All public resource paths are under `/v1` and use JSON.
2. Resource identity is a stable UUID serialized as a canonical UUID string. Slugs are stable and non-localized where the domain defines them.
3. Unknown or unsupported query parameters that affect filtering or includes return `400` with the documented problem envelope.
4. A direct lookup of an unknown or spoiler-hidden resource returns the same `404` shape.
5. Lists, cursor behavior, errors, includes, and derived values do not expose spoiler-filtered records.
6. The response `Content-Language` identifies all locales actually used; responses that can depend on `Accept-Language` vary on that header.
7. API projections do not expose persistence models or translation maps.
8. Source responses contain concise bibliographic references, never copyrighted source text.
9. Organization totals use visible active direct members and their visible `ACTIVE` bounties.
10. OpenAPI is updated with any approved contract change before implementation.

## Acceptance criteria

- Every in-scope operation, parameter, response, and public schema is represented in `openapi/openapi.yaml`.
- The contract is consistent with `docs/domain/`, `docs/api-design.md`, and `specs/v0.1-scope.md`.
- The contract does not introduce persistence strategy or behavior outside the approved domain.
- The proposal is approved before endpoint implementation begins.

## Review questions

- Approve the detail paths for resources that previously had only proposed collection paths, including number-based chapter and volume lookup.
- Approve the proposed projection fields and route-specific include allowlists.
- Approve nested volume edition and cover story episode representations.
- Approve request parameter names, pagination defaults, problem response, and status codes represented in the OpenAPI document.
