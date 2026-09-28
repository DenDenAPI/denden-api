# Localization resolution

## Goal

Define a deterministic API-layer component for selecting localized values and reporting which locales were used, following the approved localization rules.

## Scope

- Resolve a preferred response locale from an optional explicit `lang` value or an ordered list of parsed `Accept-Language` preferences.
- Match canonical BCP 47 tags case-insensitively, preferring an exact supported tag, then its base language, then English.
- Treat an explicit `lang` as an override of `Accept-Language`; if it has no supported exact or base match, use English rather than an unrelated header preference.
- Resolve each localized field independently, returning the selected value together with the locale it came from.
- Collect the distinct locales actually used for a response in deterministic fallback-priority order, for later `Content-Language` emission.
- Keep the resolver in the `api` module and free of HTTP parsing, persistence, and domain-framework dependencies.

## Out of scope

- Parsing or validating raw `Accept-Language` headers, including quality weights and malformed tags.
- Ktor route or middleware integration, `Vary` headers, and endpoint implementation.
- Database schema, translation storage, editorial translation, or Japanese romanization policy.
- Changes to the approved public API contract or to domain localization semantics.

## Requirements

1. The resolver receives already-parsed, ordered language preferences and a set of supported canonical locale tags.
2. An explicit locale takes precedence over all header preferences. Without an explicit locale, preferences are considered in their supplied order.
3. For each candidate locale, resolution checks the exact supported tag before its base language. English (`en`) is the final fallback.
4. Locale matching is case-insensitive; values returned by the resolver use the canonical supported tag.
5. Each field is resolved independently. If no value exists for the selected locale, base language, or English, the result is absent; callers decide whether to omit it or serialize `null`.
6. The reported response locales contain only locales actually used by resolved fields, are unique, and follow the same exact/base/English fallback priority.
7. The resolver is deterministic and has no mutable global state or external dependencies.

## Acceptance criteria

- Unit tests cover explicit override, ordered header preferences, exact and base-language matching, English fallback, case-insensitive matching, absent optional translations, and response-locale collection.
- Tests prove that stable identifiers and non-localized values are outside the resolver's responsibility.
- No route, public contract, persistence model, or domain behavior changes.
