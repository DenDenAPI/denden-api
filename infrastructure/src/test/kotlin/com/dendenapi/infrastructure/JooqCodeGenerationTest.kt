package com.dendenapi.infrastructure

import com.dendenapi.infrastructure.jooq.Tables.CHARACTER
import com.dendenapi.infrastructure.jooq.Tables.CHARACTER_NAME
import com.dendenapi.infrastructure.jooq.Tables.CHARACTER_NAME_SOURCE
import com.dendenapi.infrastructure.jooq.Tables.CHARACTER_NAME_TRANSLATION
import com.dendenapi.infrastructure.jooq.Tables.CHARACTER_STATUS_RECORD
import com.dendenapi.infrastructure.jooq.Tables.CHARACTER_STATUS_RECORD_SOURCE
import com.dendenapi.infrastructure.jooq.Tables.CHAPTER
import com.dendenapi.infrastructure.jooq.Tables.SOURCE
import com.dendenapi.infrastructure.jooq.Tables.VOLUME
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class JooqCodeGenerationTest {
    @Test
    fun `generation exposes every migrated application table`() {
        assertEquals(
            setOf(
                "volume",
                "chapter",
                "source",
                "character",
                "character_name",
                "character_name_translation",
                "character_status_record",
                "character_name_source",
                "character_status_record_source",
            ),
            setOf(
                VOLUME.name,
                CHAPTER.name,
                SOURCE.name,
                CHARACTER.name,
                CHARACTER_NAME.name,
                CHARACTER_NAME_TRANSLATION.name,
                CHARACTER_STATUS_RECORD.name,
                CHARACTER_NAME_SOURCE.name,
                CHARACTER_STATUS_RECORD_SOURCE.name,
            ),
        )
    }

    @Test
    fun `generation exposes temporal range and chapter reference fields`() {
        assertTrue(CHARACTER_NAME.fields().any { it.name == "validity_range" })
        assertEquals("valid_from_chapter", CHARACTER_NAME.VALID_FROM_CHAPTER.name)
        assertEquals("valid_to_chapter", CHARACTER_NAME.VALID_TO_CHAPTER.name)
        assertEquals("available_from_chapter", CHARACTER_NAME.AVAILABLE_FROM_CHAPTER.name)
        assertTrue(CHARACTER_STATUS_RECORD.fields().any { it.name == "validity_range" })
    }
}
