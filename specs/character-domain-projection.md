# Character domain projection

## Goal

Model character identity, localized historical names, and historical status in the pure domain layer, then project those facts through the approved temporal and spoiler context.

## Scope

- Add pure Kotlin domain models for `Character`, `CharacterName`, and `CharacterStatusRecord`.
- Preserve UUID identity, stable non-localized slugs, name types, translations, source identifiers, temporal validity, and spoiler availability.
- Project one optional visible primary name and one optional visible status for a known character.
- Project all visible aliases and epithets while preserving their supplied order.
- Reuse the existing temporal/spoiler projection engine for every historical fact.
- Reject facts owned by a different character and overlapping visible single-valued facts.

## Out of scope

- Persistence mappings, repositories, jOOQ queries, or schema changes.
- Locale negotiation or selection of one translated string.
- Public DTOs, routes, HTTP errors, includes, pagination, or caching.
- Deciding whether a character without a visible primary name is hidden as an entire public resource.
- Character profile facts, races, locations, organizations, bounties, Devil Fruits, or Haki.
- Publication-completeness validation for source evidence.

## Requirements

1. Character, character-name, and character-status identifiers use application-provided UUIDs.
2. A character slug is required and non-blank; it remains independent of localized names.
3. A character name has type `PRIMARY`, `ALIAS`, or `EPITHET`, at least one translation, a temporal window, and zero or more source identifiers.
4. Translation locale keys and values are non-blank. Locale canonicalization and fallback remain API-layer responsibilities.
5. A character status has value `ALIVE`, `DEAD`, or `UNKNOWN`, a temporal window, and zero or more source identifiers.
6. Every supplied name and status record must belong to the character being projected.
7. Primary name and status use single-valued temporal projection. No visible record produces an absent value; multiple visible records fail rather than being resolved arbitrarily.
8. Aliases and epithets use collection projection and preserve input order after hidden or invalid facts are removed.
9. A spoiler-hidden current fact must not be replaced with an obsolete historical fact.
10. The projection returns untranslated name records so the API localization resolver can select field values later.
11. The implementation remains pure Kotlin in `domain` with no framework, persistence, HTTP, or serialization dependency.

## Acceptance criteria

- Unit tests cover slug and translation validation.
- Unit tests project primary names, aliases, epithets, and status at inclusive story points.
- Unit tests prove names and status obey `maxChapter` independently of story validity.
- Unit tests prove an obsolete primary name or status is not substituted when the current record is spoiler-hidden.
- Unit tests prove collection order is stable after filtering.
- Unit tests reject facts owned by another character.
- Unit tests reject multiple visible primary names and multiple visible status records.
- No database schema or public API contract changes.
