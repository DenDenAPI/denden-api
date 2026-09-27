# Public API design

This document defines a proposed HTTP contract for implementation planning. It deliberately does not choose a web framework or database.

## Resource style

- Base path: `/v1`.
- JSON request and response bodies.
- Resource lookup by stable slug in human-facing routes; opaque IDs remain in representations.
- Lowercase plural resource names.
- Compact default representations; related collections require `include` or a nested endpoint.
- Enums are stable uppercase machine values and are not translated.

Proposed core routes:

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

Not every route must ship in the first implementation increment; [v0.1 scope](v0.1-scope.md) defines the commitment.

## Language negotiation

```text
?lang > Accept-Language > en
```

The server returns `Content-Language` and, when applicable, `Vary: Accept-Language`. See [localization](localization.md).

## Temporal and spoiler controls

All compatible resource routes accept:

```text
asOfChapter=<positive chapter number>
maxChapter=<positive chapter number>
```

Filters apply recursively to included resources and derived values. Lists omit resources that are not yet safely visible. Direct lookup of a hidden resource returns the same `404` shape as an unknown resource so existence itself is not leaked.

No error, pagination count, sort order or facet may disclose filtered records. Caches must vary on both parameters.

See [temporal and spoiler model](temporal-spoiler-model.md) for semantics.

## Includes

`include` is a comma-separated allowlist, not an arbitrary graph query.

Examples:

```text
GET /v1/characters/monkey-d-luffy?include=bounties,organizations,devilFruits,haki
GET /v1/organizations/straw-hat-pirates?include=members,relationships,locations
```

Unknown includes return `400` with allowed values. Every include has bounded depth and uses the request's language, temporal and spoiler context. A future `organizations.ancestors` include may expose derived effective affiliations; default organization membership remains direct only.

## Example character response

```json
{
  "id": "char_01H...",
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
  "race": {
    "id": "race_01H...",
    "slug": "human",
    "name": "Humano"
  },
  "origin": {
    "id": "loc_01H...",
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
  "id": "org_01H...",
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

The numeric values are illustrative contract examples, not seed-data assertions. Counts and totals are derived from the visible filtered graph.

## History and sources

Default detail responses return the selected current/as-of projection. Proposed opt-in includes expose history and evidence:

```text
include=statusHistory,bounties,sources
```

History records should expose both validity and availability only when doing so respects `maxChapter`. Source expansion returns compact references, not copyrighted text.

## Collections and pagination

Proposal for v0.1:

```text
page[limit]=20       default 20, maximum 100
page[cursor]=...     opaque cursor
sort=slug            explicit allowlist per resource
```

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

Initial filters should be explicit and resource-specific, for example:

```text
GET /v1/characters?organization=straw-hat-pirates
GET /v1/organizations?type=PIRATE_CREW
GET /v1/chapters?arc=east-blue
```

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
- `406` only if no representation language can be produced under the final negotiation policy;
- `429` rate limited;
- `500` unexpected server failure without internal details.

## Caching

The response varies at least by route, normalized query, resolved locale, `asOfChapter`, `maxChapter`, includes and dataset version. ETags should include the dataset revision. CDN or application caches must never reuse an unrestricted response for a spoiler-capped request.

## Compatibility

- Additive optional fields are compatible within `/v1`.
- Removing or renaming fields, changing enum meaning, or changing temporal semantics requires a new API version or a documented migration.
- Slug redirects may preserve corrected identifiers; IDs never change.
- Dataset corrections do not necessarily change the API version, but always change `datasetVersion`.
