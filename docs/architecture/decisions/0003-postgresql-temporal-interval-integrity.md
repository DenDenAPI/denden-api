# ADR 0003: PostgreSQL temporal interval integrity

- Status: Accepted
- Date: 2026-09-27

## Context

The domain defines inclusive validity intervals over the manga chapter sequence. Bounds can be unknown, represented as `null`; an unknown bound must not be treated as evidence that a fact is false. Single-valued historical facts and a character's primary name may not have overlapping validity intervals. Reader availability (`availableFromChapter`) is a separate spoiler axis and must not be conflated with fictional validity.

PostgreSQL range exclusion constraints can enforce non-overlap, but a UUID identifies a chapter without representing its place in the story sequence. The schema therefore needs an ordered chapter coordinate that is still a validated reference to a `Chapter`.

## Decision

- Keep chapter UUIDs as primary keys and public identifiers.
- Store temporal chapter references against the unique canonical `Chapter.number` alternate key, with a foreign key to `Chapter`. This applies to validity and availability chapter bounds. A chapter number used this way is a validated reference, never a free-standing integer.
- Enforce `validToChapter >= validFromChapter` when both bounds are known.
- Represent a fact's inclusive validity bounds as a PostgreSQL integer range using both-inclusive semantics. A `null` lower or upper bound maps to an unbounded range endpoint, conservatively preventing records from overlapping any interval that could include that unknown portion.
- Enable PostgreSQL's supplied `btree_gist` extension through Flyway. Add GiST exclusion constraints combining equality on the subject key with overlap (`&&`) on the validity range for each single-valued fact table that has validity intervals. Apply a partial exclusion constraint to `CharacterName` rows of type `PRIMARY`.
- Keep `availableFromChapter` independent: it participates in reader-knowledge filtering, not the fictional-validity overlap range.
- Verify these constraints against PostgreSQL in Testcontainers integration tests. Application validation may provide clearer errors, but it is not a substitute for the database constraints.

This decision covers single-valued temporal intervals and primary character names. It does not define enforcement for cross-table invariants such as role assignments being contained by membership intervals; those must be addressed when the corresponding schema is designed.

## Consequences

- Invalid overlapping histories are rejected by PostgreSQL, including concurrent writes and data imports.
- Temporal chapter bounds have foreign-key integrity and remain ordered by the canonical manga chapter number, while chapter UUID identity remains independent.
- Unknown interval bounds are conservative for overlap checks. Editors may need to supply more precise bounds before otherwise plausible distinct records can coexist.
- Schema migrations must enable `btree_gist` before creating the affected exclusion constraints.

## References

- [Temporal and spoiler model](../../domain/temporal-spoiler-model.md)
- [PostgreSQL 18 exclusion constraints](https://www.postgresql.org/docs/18/ddl-constraints.html#DDL-CONSTRAINTS-EXCLUSION)
- [PostgreSQL 18 range constraints](https://www.postgresql.org/docs/18/rangetypes.html#RANGETYPES-CONSTRAINT)
- [PostgreSQL 18 `btree_gist`](https://www.postgresql.org/docs/18/btree-gist.html)
