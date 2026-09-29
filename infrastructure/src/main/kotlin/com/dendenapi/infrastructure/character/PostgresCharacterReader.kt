package com.dendenapi.infrastructure.character

import com.dendenapi.application.character.CharacterAggregate
import com.dendenapi.application.character.CharacterReader
import com.dendenapi.domain.character.Character
import com.dendenapi.domain.character.CharacterName
import com.dendenapi.domain.character.CharacterNameType
import com.dendenapi.domain.character.CharacterStatus
import com.dendenapi.domain.character.CharacterStatusRecord
import com.dendenapi.domain.temporal.ChapterNumber
import com.dendenapi.domain.temporal.TemporalWindow
import com.dendenapi.infrastructure.jooq.Tables.CHARACTER
import com.dendenapi.infrastructure.jooq.Tables.CHARACTER_NAME
import com.dendenapi.infrastructure.jooq.Tables.CHARACTER_NAME_SOURCE
import com.dendenapi.infrastructure.jooq.Tables.CHARACTER_NAME_TRANSLATION
import com.dendenapi.infrastructure.jooq.Tables.CHARACTER_STATUS_RECORD
import com.dendenapi.infrastructure.jooq.Tables.CHARACTER_STATUS_RECORD_SOURCE
import java.util.UUID
import org.jooq.DSLContext

class PostgresCharacterReader(
    private val dsl: DSLContext,
) : CharacterReader {
    override fun findBySlug(slug: String): CharacterAggregate? {
        val characterRecord =
            dsl.selectFrom(CHARACTER)
                .where(CHARACTER.SLUG.eq(slug))
                .fetchOne() ?: return null

        val characterId = requireNotNull(characterRecord.id)
        val character =
            Character(
                id = characterId,
                slug = requireNotNull(characterRecord.slug),
                firstMentionChapterId = characterRecord.firstMentionChapterId,
                firstAppearanceChapterId = characterRecord.firstAppearanceChapterId,
            )

        val nameRecords =
            dsl.selectFrom(CHARACTER_NAME)
                .where(CHARACTER_NAME.CHARACTER_ID.eq(characterId))
                .orderBy(CHARACTER_NAME.AVAILABLE_FROM_CHAPTER, CHARACTER_NAME.ID)
                .fetch()
        val nameIds = nameRecords.map { requireNotNull(it.id) }

        val translationsByName = linkedMapOf<UUID, MutableMap<String, String>>()
        val sourcesByName = linkedMapOf<UUID, MutableSet<UUID>>()
        if (nameIds.isNotEmpty()) {
            dsl.selectFrom(CHARACTER_NAME_TRANSLATION)
                .where(CHARACTER_NAME_TRANSLATION.CHARACTER_NAME_ID.`in`(nameIds))
                .orderBy(CHARACTER_NAME_TRANSLATION.CHARACTER_NAME_ID, CHARACTER_NAME_TRANSLATION.LOCALE)
                .fetch()
                .forEach { record ->
                    val ownerId = requireNotNull(record.characterNameId)
                    translationsByName.getOrPut(ownerId, ::linkedMapOf)
                        .put(requireNotNull(record.locale), requireNotNull(record.value))
                }

            dsl.selectFrom(CHARACTER_NAME_SOURCE)
                .where(CHARACTER_NAME_SOURCE.CHARACTER_NAME_ID.`in`(nameIds))
                .orderBy(CHARACTER_NAME_SOURCE.CHARACTER_NAME_ID, CHARACTER_NAME_SOURCE.SOURCE_ID)
                .fetch()
                .forEach { record ->
                    val ownerId = requireNotNull(record.characterNameId)
                    sourcesByName.getOrPut(ownerId, ::linkedSetOf).add(requireNotNull(record.sourceId))
                }
        }

        val names =
            nameRecords.map { record ->
                val nameId = requireNotNull(record.id)
                CharacterName(
                    id = nameId,
                    characterId = characterId,
                    type = CharacterNameType.valueOf(requireNotNull(record.type)),
                    translations = translationsByName[nameId].orEmpty(),
                    window =
                        TemporalWindow(
                            validFromChapter = record.validFromChapter?.let(::ChapterNumber),
                            validToChapter = record.validToChapter?.let(::ChapterNumber),
                            availableFromChapter = ChapterNumber(requireNotNull(record.availableFromChapter)),
                        ),
                    sourceIds = sourcesByName[nameId].orEmpty(),
                )
            }

        val statusRecords =
            dsl.selectFrom(CHARACTER_STATUS_RECORD)
                .where(CHARACTER_STATUS_RECORD.CHARACTER_ID.eq(characterId))
                .orderBy(CHARACTER_STATUS_RECORD.AVAILABLE_FROM_CHAPTER, CHARACTER_STATUS_RECORD.ID)
                .fetch()
        val statusIds = statusRecords.map { requireNotNull(it.id) }
        val sourcesByStatus = linkedMapOf<UUID, MutableSet<UUID>>()
        if (statusIds.isNotEmpty()) {
            dsl.selectFrom(CHARACTER_STATUS_RECORD_SOURCE)
                .where(CHARACTER_STATUS_RECORD_SOURCE.CHARACTER_STATUS_RECORD_ID.`in`(statusIds))
                .orderBy(
                    CHARACTER_STATUS_RECORD_SOURCE.CHARACTER_STATUS_RECORD_ID,
                    CHARACTER_STATUS_RECORD_SOURCE.SOURCE_ID,
                )
                .fetch()
                .forEach { record ->
                    val ownerId = requireNotNull(record.characterStatusRecordId)
                    sourcesByStatus.getOrPut(ownerId, ::linkedSetOf).add(requireNotNull(record.sourceId))
                }
        }

        val statuses =
            statusRecords.map { record ->
                val statusId = requireNotNull(record.id)
                CharacterStatusRecord(
                    id = statusId,
                    characterId = characterId,
                    status = CharacterStatus.valueOf(requireNotNull(record.status)),
                    window =
                        TemporalWindow(
                            validFromChapter = record.validFromChapter?.let(::ChapterNumber),
                            validToChapter = record.validToChapter?.let(::ChapterNumber),
                            availableFromChapter = ChapterNumber(requireNotNull(record.availableFromChapter)),
                        ),
                    sourceIds = sourcesByStatus[statusId].orEmpty(),
                )
            }

        return CharacterAggregate(character = character, names = names, statuses = statuses)
    }
}
