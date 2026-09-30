# v1 API contract

## Status

Approved on 2026-09-30. The machine-readable contract is [`../openapi/openapi.yaml`](../openapi/openapi.yaml). Endpoint implementations are being delivered incrementally.

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
- Bounded includes for character and organization detail and collection routes.
- Bounded `chapters` and `editions` includes on volume detail, and `episodes` on cover-story detail.
- Explicit route-specific collection filters and sort keys.
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
11. Detail routes use stable slugs for named resources, main-series numbers for chapters and volumes, and UUIDs for sources.
12. Includes are available only on character and organization collection/detail routes, volume detail, and cover-story detail.
13. An unrequested include field is omitted; a requested include is returned as an array, including an empty array when it has no visible results. An explicitly empty `include` value is invalid.
14. Duplicate include tokens are deduplicated; whitespace around tokens is ignored; unknown tokens return `400`.
15. Collection filters are allowlisted: `organization` for characters, `type` for organizations, `saga` for arcs, and `arc` for chapters.
16. Collection cursors bind to the resource, sort, filters, includes, effective locale, temporal context, and dataset version. The page limit may change between requests; an invalid or context-mismatched cursor returns `400`.

## Acceptance criteria

- Every in-scope operation, parameter, response, and public schema is represented in `openapi/openapi.yaml`.
- The contract is consistent with `docs/domain/`, `docs/api-design.md`, and `specs/v0.1-scope.md`.
- The contract does not introduce persistence strategy or behavior outside the approved domain.
- This approved contract is the source of truth for endpoint implementation.

## Approved review decisions

- Detail routes use stable slugs for named resources and numbers for chapters and volumes.
- Projection fields and route-specific include allowlists are approved as represented in OpenAPI.
- Volume editions and cover-story episodes are bounded nested detail includes.
- Request parameters, pagination defaults, problem envelope, and status codes are approved as represented in OpenAPI.
- `406` is not part of the contract because English fallback always supplies a response language.
