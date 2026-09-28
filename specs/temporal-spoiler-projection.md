# Temporal and spoiler projection

## Goal

Define a deterministic domain component that selects facts for a fictional-world chapter while independently enforcing a reader-knowledge cap.

## Scope

- Represent positive canonical chapter coordinates used by temporal projection.
- Build a projection context from the dataset's maximum ingested chapter and optional `asOfChapter` and `maxChapter` controls.
- Use the maximum ingested chapter as the effective story point when `asOfChapter` is omitted.
- Reject either request chapter when it exceeds the maximum ingested chapter.
- Evaluate inclusive validity intervals with independently optional lower and upper bounds.
- Hide facts whose `availableFromChapter` exceeds the effective reader-knowledge cap.
- Filter collections of facts and select an optional single-valued fact without silently resolving overlapping visible records.
- Keep the component pure Kotlin in the `domain` module.

## Out of scope

- Parsing HTTP query parameters or mapping failures to problem responses.
- Looking up chapter records or dataset metadata through persistence ports.
- Database schema, migrations, jOOQ queries, or interval exclusion constraints.
- Resource-level visibility for characters, organizations, or other first-class resources.
- Recursive API DTO construction, localization, includes, pagination, or cache behavior.
- Derived organization values such as member counts and total bounties.
- History and source representation in public responses.

## Requirements

1. Chapter coordinates are positive integers. Callers remain responsible for resolving them against canonical `Chapter` records at integration boundaries.
2. A projection context requires the positive maximum ingested chapter exposed by the current dataset.
3. `asOfChapter` and `maxChapter`, when supplied, must not exceed the maximum ingested chapter.
4. Omitting `asOfChapter` selects the dataset's maximum ingested chapter as the effective fictional-world story point.
5. Omitting `maxChapter` uses the dataset's maximum ingested chapter as the effective reader-knowledge cap, representing the latest published view available in that dataset.
6. `asOfChapter` may be greater than `maxChapter`; the two axes remain independent.
7. Validity bounds are inclusive. A missing lower or upper bound is unknown and cannot exclude a fact on that side.
8. A fact is visible only when it is valid at the effective story point and its `availableFromChapter` is not greater than the effective reader-knowledge cap.
9. An interval whose known upper bound is lower than its known lower bound is invalid.
10. Collection filtering preserves input order.
11. Selection for a single-valued fact returns no value when no fact is visible and fails when more than one fact is visible. It must never pick an overlapping record arbitrarily.
12. The component has no mutable global state, framework dependency, persistence dependency, or API serialization concern.

## Acceptance criteria

- Unit tests cover positive chapter validation and invalid interval ordering.
- Unit tests prove that omitted controls select the latest ingested view.
- Unit tests cover inclusive lower and upper bounds and conservative unknown bounds.
- Unit tests prove that validity and availability are independent, including `asOfChapter > maxChapter`.
- Unit tests prove that a late reveal is absent until the reader-knowledge cap reaches its availability chapter.
- Unit tests cover collection filtering, absent single-valued projections, and rejection of multiple visible single-valued facts.
- Unit tests prove that request chapters beyond the dataset maximum are rejected.
- No HTTP contract shape, persistence model, migration, or domain entity semantics change.
