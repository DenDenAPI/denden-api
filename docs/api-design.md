# Public API design

This document describes the approved HTTP contract for v1 implementation. The machine-readable contract is [`openapi/openapi.yaml`](../openapi/openapi.yaml), and its requirements are in the [v1 API contract specification](../specs/api-v1-contract.md). It deliberately does not choose a database or persistence strategy.

## Resource style

- Base path: `/v1`.
- JSON request and response bodies.
- Resource lookup by stable slug in human-facing routes; opaque IDs remain in representations.
- Lowercase plural resource names.
- Compact default representations; related collections require `include` or a nested endpoint.
- Enums are stable uppercase machine values and are not translated.

Core v1 routes:

```text
GET /v1/characters
GET /v1/characters/{slug}
GET /v1/organizations
GET /v1/organizations/{slug}
GET /v1/races
GET /v1/locations
GET /v1/devil-fruits
GET /v1/sagas
GET /v1/arcs
GET /v1/chapters
GET /v1/volumes
GET /v1/cover-stories
GET /v1/sources/{id}
GET /v1/meta
```

Not every route must ship in the first implementation increment; [v0.1 scope](../specs/v0.1-scope.md) defines the commitment.

## Language negotiation

```text
?lang > Accept-Language > en
```

Localized fields use the deterministic fallback chain exact requested tag, base language, then English. Mixed-language field fallback is allowed; `Content-Language` lists every locale actually present in fallback-priority order. The server returns `Vary: Accept-Language` when the response can depend on that header. See [localization](domain/localization.md).

## Temporal and spoiler controls

All compatible resource routes accept:

```text
asOfChapter=<positive chapter number>
maxChapter=<positive chapter number>
```

Filters apply recursively to included resources and derived values. Lists omit resources that are not yet safely visible. Direct lookup of a hidden resource returns the same `404` shape as an unknown resource so existence itself is not leaked.

When omitted, each control defaults independently to the dataset's maximum ingested chapter. A supplied chapter above that maximum returns `400` and reports the supported maximum. `asOfChapter` may be greater than `maxChapter`; the spoiler cap still takes precedence over exposure.

No error, pagination count, sort order or facet may disclose filtered records. Caches must vary on both parameters.

See [temporal and spoiler model](domain/temporal-spoiler-model.md) for semantics.


## Includes

`include` is a comma-separated allowlist, not an arbitrary graph query.

Examples:

```text
GET /v1/characters/monkey-d-luffy?include=bounties,organizations,devilFruits,haki
GET /v1/organizations/straw-hat-pirates?include=members,relationships,locations
GET /v1/volumes/1?include=chapters,editions
GET /v1/cover-stories/dawns-romance?include=episodes
```

Includes are available on character and organization collection/detail routes, volume detail, and cover-story detail. Unrequested expansion fields are omitted; requested expansions are returned as arrays, including `[]` when no visible results exist. An explicitly empty include value is invalid. Duplicate tokens are deduplicated and token whitespace is ignored.

Unknown includes return `400` with allowed values. Every include has bounded depth and uses the request's language, temporal and spoiler context. A future `organizations.ancestors` include may expose derived effective affiliations; default organization membership remains direct only.

## Example character response

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "slug": "monkey-d-luffy",
  "name": "Monkey D. Luffy",
  "aliases": [],
  "epithets": ["Sombrero de Paja"],
  "gender": "MALE",
  "birthday": {
    "month": 5,
    "day": 5
  },
  "status": "ALIVE",
  "races": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "slug": "human",
      "name": "Humano"
    }
  ],
  "origin": {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "slug": "foosha-village",
    "name": "Villa Foosha"
  },
  "debut": {
    "chapter": 1
  }
}
```

This shape is a projection. It does not imply scalar `status`, `race` or `origin` columns in storage.

## Example organization response

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440003",
  "slug": "straw-hat-pirates",
  "name": "Piratas de Sombrero de Paja",
  "type": "PIRATE_CREW",
  "status": "ACTIVE",
  "memberCount": 10,
  "totalBounty": 8816001000,
  "debut": {
    "chapter": 5
  }
}
```

Named resources use stable slugs in detail paths; chapter and volume detail paths use their main-series number; source detail paths use canonical UUIDs. Every resource ID in a response is a canonical UUID string.

The numeric values are illustrative contract examples, not seed-data assertions. Counts and totals are derived from the visible filtered graph.

## History and sources

Default detail responses return the selected current/as-of projection. Opt-in includes expose history and evidence:

```text
include=statusHistory,bounties,sources
```

History records should expose both validity and availability only when doing so respects `maxChapter`. Source expansion returns compact references, not copyrighted text.

## Collections and pagination

Proposal for v0.1:

```text
page[limit]=20       default 20, maximum 100
page[cursor]=...     opaque cursor
sort=slug            explicit allowlist for slug-ordered resources
sort=number          chapters and volumes, ascending
```

The cursor binds to resource, sort, filters, includes, effective locale, temporal context, and dataset version. Clients may change `page[limit]` while following a cursor. Invalid or mismatched cursors return `400`.

Response envelope:

```json
{
  "data": [],
  "page": {
    "nextCursor": null
  }
}
```

Avoid total counts in spoiler-filtered collections unless they can be computed without leaking hidden entities. Cursor contents are opaque and must bind to query/filter context.

## Filtering and search

The v1 filter allowlist is explicit and resource-specific:

```text
GET /v1/characters?organization=straw-hat-pirates
GET /v1/organizations?type=PIRATE_CREW
GET /v1/arcs?saga=east-blue
GET /v1/chapters?arc=east-blue
```

`organization` filters characters by direct membership; `type` filters organizations; `saga` filters arcs; and `arc` filters chapters. Other collection routes do not accept resource-specific filters.

Full-text search, advanced graph queries and arbitrary field selection are deferred. Search indexes must eventually apply the same spoiler rules as canonical reads.

## Errors

Use a stable problem-details-style envelope:

```json
{
  "type": "https://dendenapi.example/problems/invalid-parameter",
  "title": "Invalid request parameter",
  "status": 400,
  "detail": "maxChapter must be a positive chapter number",
  "instance": "/v1/characters/..."
}
```

Expected statuses:

- `400` invalid language, filter, include or chapter bound;
- `404` unknown or spoiler-hidden resource;
- `429` rate limited;
- `500` unexpected server failure without internal details.

## Caching

The response varies at least by route, normalized query, resolved locale, `asOfChapter`, `maxChapter`, includes and dataset version. ETags should include the dataset revision. CDN or application caches must never reuse an unrestricted response for a spoiler-capped request.

## Compatibility

- Additive optional fields are compatible within `/v1`.
- Removing or renaming fields, changing enum meaning, or changing temporal semantics requires a new API version or a documented migration.
- Slug redirects may preserve corrected identifiers; IDs never change.
- Dataset corrections do not necessarily change the API version, but always change `datasetVersion`.
