CREATE TABLE volume (
    id UUID PRIMARY KEY,
    number INTEGER NOT NULL,
    CONSTRAINT volume_number_positive CHECK (number > 0),
    CONSTRAINT volume_number_unique UNIQUE (number)
);

CREATE TABLE volume_translation (
    volume_id UUID NOT NULL REFERENCES volume (id),
    locale TEXT NOT NULL,
    title TEXT NOT NULL,
    CONSTRAINT volume_translation_pk PRIMARY KEY (volume_id, locale)
);

CREATE TABLE chapter (
    id UUID PRIMARY KEY,
    number INTEGER NOT NULL,
    volume_id UUID REFERENCES volume (id),
    page_count INTEGER,
    japanese_release_date DATE,
    wsj_issue TEXT,
    cover_type TEXT NOT NULL,
    CONSTRAINT chapter_number_positive CHECK (number > 0),
    CONSTRAINT chapter_number_unique UNIQUE (number),
    CONSTRAINT chapter_page_count_positive CHECK (page_count IS NULL OR page_count > 0),
    CONSTRAINT chapter_cover_type_valid CHECK (
        cover_type IN ('STANDARD', 'COLOR_SPREAD', 'COVER_STORY', 'OTHER')
    )
);

CREATE INDEX chapter_volume_number_idx ON chapter (volume_id, number);

CREATE TABLE chapter_translation (
    chapter_id UUID NOT NULL REFERENCES chapter (id),
    locale TEXT NOT NULL,
    title TEXT NOT NULL,
    CONSTRAINT chapter_translation_pk PRIMARY KEY (chapter_id, locale)
);

CREATE TABLE source (
    id UUID PRIMARY KEY,
    type TEXT NOT NULL,
    chapter_id UUID REFERENCES chapter (id),
    volume_id UUID REFERENCES volume (id),
    locator TEXT,
    reference_label TEXT,
    publication_date DATE,
    CONSTRAINT source_type_valid CHECK (
        type IN ('MANGA_CHAPTER', 'SBS', 'VIVRE_CARD', 'DATABOOK', 'OTHER_OFFICIAL')
    )
);
