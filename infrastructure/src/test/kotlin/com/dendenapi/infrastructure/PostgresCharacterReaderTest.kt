package com.dendenapi.infrastructure

import com.dendenapi.domain.character.CharacterNameType
import com.dendenapi.domain.character.CharacterStatus
import com.dendenapi.domain.temporal.ChapterNumber
import com.dendenapi.infrastructure.character.PostgresCharacterReader
import com.dendenapi.infrastructure.jooq.Tables.CHARACTER
import com.dendenapi.infrastructure.jooq.Tables.CHARACTER_NAME
import com.dendenapi.infrastructure.jooq.Tables.CHARACTER_NAME_SOURCE
import com.dendenapi.infrastructure.jooq.Tables.CHARACTER_NAME_TRANSLATION
import com.dendenapi.infrastructure.jooq.Tables.CHARACTER_STATUS_RECORD
import com.dendenapi.infrastructure.jooq.Tables.CHARACTER_STATUS_RECORD_SOURCE
import com.dendenapi.infrastructure.jooq.Tables.CHAPTER
import com.dendenapi.infrastructure.jooq.Tables.SOURCE
import java.util.UUID
import java.sql.DriverManager
import org.flywaydb.core.Flyway
import org.jooq.DSLContext
import org.jooq.SQLDialect
import org.jooq.impl.DSL
import org.junit.jupiter.api.Test
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers
import org.testcontainers.postgresql.PostgreSQLContainer
import kotlin.test.assertEquals
import kotlin.test.assertNull

@Testcontainers
class PostgresCharacterReaderTest {
    @Test
    fun `loads complete character history with translations and typed evidence`() {
        val flyway =
            Flyway.configure()
                .dataSource(postgres.jdbcUrl, postgres.username, postgres.password)
                .locations("classpath:db/migration")
                .load()
        flyway.migrate()

        DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
            val dsl = DSL.using(connection, SQLDialect.POSTGRES)
            assertNull(PostgresCharacterReader(dsl).findBySlug("missing-character"))

            val fixture = insertFixture(dsl)
            val aggregate = requireNotNull(PostgresCharacterReader(dsl).findBySlug(fixture.slug))

            assertEquals(fixture.characterId, aggregate.character.id)
            assertEquals(fixture.slug, aggregate.character.slug)
            assertEquals(fixture.firstMentionChapterId, aggregate.character.firstMentionChapterId)
            assertEquals(fixture.firstAppearanceChapterId, aggregate.character.firstAppearanceChapterId)

            assertEquals(4, aggregate.names.size)
            assertEquals(
                mapOf(
                    fixture.oldPrimaryNameId to CharacterNameType.PRIMARY,
                    fixture.currentPrimaryNameId to CharacterNameType.PRIMARY,
                    fixture.aliasId to CharacterNameType.ALIAS,
                    fixture.epithetId to CharacterNameType.EPITHET,
                ),
                aggregate.names.associate { it.id to it.type },
            )

            val oldPrimary = aggregate.names.single { it.id == fixture.oldPrimaryNameId }
            assertEquals(1, oldPrimary.window.validFromChapter?.value)
            assertEquals(10, oldPrimary.window.validToChapter?.value)
            assertEquals(ChapterNumber(1), oldPrimary.window.availableFromChapter)
            assertEquals(mapOf("en" to "Old name", "es" to "Nombre anterior"), oldPrimary.translations)
            assertEquals(setOf(fixture.mangaSourceId, fixture.sbsSourceId), oldPrimary.sourceIds)

            val currentPrimary = aggregate.names.single { it.id == fixture.currentPrimaryNameId }
            assertEquals(11, currentPrimary.window.validFromChapter?.value)
            assertNull(currentPrimary.window.validToChapter)
            assertEquals(ChapterNumber(11), currentPrimary.window.availableFromChapter)
            assertEquals(mapOf("en" to "Current name"), currentPrimary.translations)

            val alias = aggregate.names.single { it.id == fixture.aliasId }
            assertNull(alias.window.validFromChapter)
            assertNull(alias.window.validToChapter)
            assertEquals(setOf(fixture.sbsSourceId), alias.sourceIds)

            assertEquals(
                listOf(CharacterStatus.UNKNOWN, CharacterStatus.ALIVE),
                aggregate.statuses.map { it.status },
            )
            val historicalStatus = aggregate.statuses.first()
            assertNull(historicalStatus.window.validFromChapter)
            assertEquals(10, historicalStatus.window.validToChapter?.value)
            assertEquals(setOf(fixture.mangaSourceId), historicalStatus.sourceIds)

            val currentStatus = aggregate.statuses.last()
            assertEquals(11, currentStatus.window.validFromChapter?.value)
            assertNull(currentStatus.window.validToChapter)
            assertEquals(setOf(fixture.sbsSourceId), currentStatus.sourceIds)
        }
    }

    private fun insertFixture(dsl: DSLContext): Fixture {
        val chapter1 = UUID.randomUUID()
        val chapter10 = UUID.randomUUID()
        val chapter11 = UUID.randomUUID()
        val chapter20 = UUID.randomUUID()
        listOf(1 to chapter1, 10 to chapter10, 11 to chapter11, 20 to chapter20).forEach { (number, id) ->
            dsl.insertInto(CHAPTER)
                .set(CHAPTER.ID, id)
                .set(CHAPTER.NUMBER, number)
                .set(CHAPTER.COVER_TYPE, "STANDARD")
                .execute()
        }

        val mangaSourceId = UUID.randomUUID()
        val sbsSourceId = UUID.randomUUID()
        dsl.insertInto(SOURCE)
            .set(SOURCE.ID, mangaSourceId)
            .set(SOURCE.TYPE, "MANGA_CHAPTER")
            .set(SOURCE.CHAPTER_ID, chapter1)
            .execute()
        dsl.insertInto(SOURCE)
            .set(SOURCE.ID, sbsSourceId)
            .set(SOURCE.TYPE, "SBS")
            .execute()

        val characterId = UUID.randomUUID()
        val slug = "test-character"
        dsl.insertInto(CHARACTER)
            .set(CHARACTER.ID, characterId)
            .set(CHARACTER.SLUG, slug)
            .set(CHARACTER.FIRST_MENTION_CHAPTER_ID, chapter1)
            .set(CHARACTER.FIRST_APPEARANCE_CHAPTER_ID, chapter10)
            .execute()

        val oldPrimaryNameId = UUID.randomUUID()
        val currentPrimaryNameId = UUID.randomUUID()
        val aliasId = UUID.randomUUID()
        val epithetId = UUID.randomUUID()
        insertName(dsl, oldPrimaryNameId, characterId, "PRIMARY", 1, 10, 1)
        insertName(dsl, currentPrimaryNameId, characterId, "PRIMARY", 11, null, 11)
        insertName(dsl, aliasId, characterId, "ALIAS", null, null, 1)
        insertName(dsl, epithetId, characterId, "EPITHET", 11, null, 11)

        insertNameTranslation(dsl, oldPrimaryNameId, "en", "Old name")
        insertNameTranslation(dsl, oldPrimaryNameId, "es", "Nombre anterior")
        insertNameTranslation(dsl, currentPrimaryNameId, "en", "Current name")
        insertNameTranslation(dsl, aliasId, "en", "Alias")
        insertNameTranslation(dsl, epithetId, "en", "Epithet")

        insertNameSource(dsl, oldPrimaryNameId, mangaSourceId)
        insertNameSource(dsl, oldPrimaryNameId, sbsSourceId)
        insertNameSource(dsl, aliasId, sbsSourceId)

        val oldStatusId = UUID.randomUUID()
        val currentStatusId = UUID.randomUUID()
        insertStatus(dsl, oldStatusId, characterId, "UNKNOWN", null, 10, 1)
        insertStatus(dsl, currentStatusId, characterId, "ALIVE", 11, null, 11)
        insertStatusSource(dsl, oldStatusId, mangaSourceId)
        insertStatusSource(dsl, currentStatusId, sbsSourceId)

        return Fixture(
            characterId = characterId,
            slug = slug,
            firstMentionChapterId = chapter1,
            firstAppearanceChapterId = chapter10,
            oldPrimaryNameId = oldPrimaryNameId,
            currentPrimaryNameId = currentPrimaryNameId,
            aliasId = aliasId,
            epithetId = epithetId,
            mangaSourceId = mangaSourceId,
            sbsSourceId = sbsSourceId,
        )
    }

    private fun insertName(
        dsl: DSLContext,
        id: UUID,
        characterId: UUID,
        type: String,
        validFrom: Int?,
        validTo: Int?,
        availableFrom: Int,
    ) {
        dsl.insertInto(CHARACTER_NAME)
            .set(CHARACTER_NAME.ID, id)
            .set(CHARACTER_NAME.CHARACTER_ID, characterId)
            .set(CHARACTER_NAME.TYPE, type)
            .set(CHARACTER_NAME.VALID_FROM_CHAPTER, validFrom)
            .set(CHARACTER_NAME.VALID_TO_CHAPTER, validTo)
            .set(CHARACTER_NAME.AVAILABLE_FROM_CHAPTER, availableFrom)
            .execute()
    }

    private fun insertNameTranslation(dsl: DSLContext, nameId: UUID, locale: String, value: String) {
        dsl.insertInto(CHARACTER_NAME_TRANSLATION)
            .set(CHARACTER_NAME_TRANSLATION.CHARACTER_NAME_ID, nameId)
            .set(CHARACTER_NAME_TRANSLATION.LOCALE, locale)
            .set(CHARACTER_NAME_TRANSLATION.VALUE, value)
            .execute()
    }

    private fun insertNameSource(dsl: DSLContext, nameId: UUID, sourceId: UUID) {
        dsl.insertInto(CHARACTER_NAME_SOURCE)
            .set(CHARACTER_NAME_SOURCE.CHARACTER_NAME_ID, nameId)
            .set(CHARACTER_NAME_SOURCE.SOURCE_ID, sourceId)
            .execute()
    }

    private fun insertStatus(
        dsl: DSLContext,
        id: UUID,
        characterId: UUID,
        status: String,
        validFrom: Int?,
        validTo: Int?,
        availableFrom: Int,
    ) {
        dsl.insertInto(CHARACTER_STATUS_RECORD)
            .set(CHARACTER_STATUS_RECORD.ID, id)
            .set(CHARACTER_STATUS_RECORD.CHARACTER_ID, characterId)
            .set(CHARACTER_STATUS_RECORD.STATUS, status)
            .set(CHARACTER_STATUS_RECORD.VALID_FROM_CHAPTER, validFrom)
            .set(CHARACTER_STATUS_RECORD.VALID_TO_CHAPTER, validTo)
            .set(CHARACTER_STATUS_RECORD.AVAILABLE_FROM_CHAPTER, availableFrom)
            .execute()
    }

    private fun insertStatusSource(dsl: DSLContext, statusId: UUID, sourceId: UUID) {
        dsl.insertInto(CHARACTER_STATUS_RECORD_SOURCE)
            .set(CHARACTER_STATUS_RECORD_SOURCE.CHARACTER_STATUS_RECORD_ID, statusId)
            .set(CHARACTER_STATUS_RECORD_SOURCE.SOURCE_ID, sourceId)
            .execute()
    }

    private data class Fixture(
        val characterId: UUID,
        val slug: String,
        val firstMentionChapterId: UUID,
        val firstAppearanceChapterId: UUID,
        val oldPrimaryNameId: UUID,
        val currentPrimaryNameId: UUID,
        val aliasId: UUID,
        val epithetId: UUID,
        val mangaSourceId: UUID,
        val sbsSourceId: UUID,
    )

    companion object {
        @Container
        @JvmStatic
        val postgres = PostgreSQLContainer("postgres:18-alpine")
    }
}
