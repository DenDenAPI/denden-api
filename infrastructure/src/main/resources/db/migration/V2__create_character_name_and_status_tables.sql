CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE character (
    id UUID PRIMARY KEY,
    slug TEXT NOT NULL,
    first_mention_chapter_id UUID REFERENCES chapter (id),
    first_appearance_chapter_id UUID REFERENCES chapter (id),
    CONSTRAINT character_slug_non_empty CHECK (btrim(slug) <> ''),
    CONSTRAINT character_slug_unique UNIQUE (slug)
);

CREATE TABLE character_name (
    id UUID PRIMARY KEY,
    character_id UUID NOT NULL REFERENCES character (id),
    type TEXT NOT NULL,
    valid_from_chapter INTEGER REFERENCES chapter (number),
    valid_to_chapter INTEGER REFERENCES chapter (number),
    available_from_chapter INTEGER NOT NULL REFERENCES chapter (number),
    validity_range INT4RANGE GENERATED ALWAYS AS (
        int4range(valid_from_chapter, valid_to_chapter, '[]')
    ) STORED,
    CONSTRAINT character_name_type_valid CHECK (type IN ('PRIMARY', 'ALIAS', 'EPITHET')),
    CONSTRAINT character_name_validity_order CHECK (
        valid_from_chapter IS NULL
        OR valid_to_chapter IS NULL
        OR valid_to_chapter >= valid_from_chapter
    ),
    CONSTRAINT character_name_primary_validity_excl EXCLUDE USING gist (
        character_id WITH =,
        validity_range WITH &&
    ) WHERE (type = 'PRIMARY')
);

CREATE TABLE character_name_translation (
    character_name_id UUID NOT NULL REFERENCES character_name (id),
    locale TEXT NOT NULL,
    value TEXT NOT NULL,
    CONSTRAINT character_name_translation_pk PRIMARY KEY (character_name_id, locale)
);

CREATE TABLE character_status_record (
    id UUID PRIMARY KEY,
    character_id UUID NOT NULL REFERENCES character (id),
    status TEXT NOT NULL,
    valid_from_chapter INTEGER REFERENCES chapter (number),
    valid_to_chapter INTEGER REFERENCES chapter (number),
    available_from_chapter INTEGER NOT NULL REFERENCES chapter (number),
    validity_range INT4RANGE GENERATED ALWAYS AS (
        int4range(valid_from_chapter, valid_to_chapter, '[]')
    ) STORED,
    CONSTRAINT character_status_value_valid CHECK (status IN ('ALIVE', 'DEAD', 'UNKNOWN')),
    CONSTRAINT character_status_validity_order CHECK (
        valid_from_chapter IS NULL
        OR valid_to_chapter IS NULL
        OR valid_to_chapter >= valid_from_chapter
    ),
    CONSTRAINT character_status_validity_excl EXCLUDE USING gist (
        character_id WITH =,
        validity_range WITH &&
    )
);

CREATE TABLE character_name_source (
    character_name_id UUID NOT NULL REFERENCES character_name (id),
    source_id UUID NOT NULL REFERENCES source (id),
    CONSTRAINT character_name_source_pk PRIMARY KEY (character_name_id, source_id)
);

CREATE TABLE character_status_record_source (
    character_status_record_id UUID NOT NULL REFERENCES character_status_record (id),
    source_id UUID NOT NULL REFERENCES source (id),
    CONSTRAINT character_status_record_source_pk PRIMARY KEY (character_status_record_id, source_id)
);
