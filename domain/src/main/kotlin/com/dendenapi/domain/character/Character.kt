package com.dendenapi.domain.character

import com.dendenapi.domain.temporal.ProjectionContext
import com.dendenapi.domain.temporal.TemporalFact
import com.dendenapi.domain.temporal.TemporalProjectionEngine
import com.dendenapi.domain.temporal.TemporalWindow
import java.util.UUID

data class Character(
    val id: UUID,
    val slug: String,
    val firstMentionChapterId: UUID? = null,
    val firstAppearanceChapterId: UUID? = null,
) {
    init {
        require(slug.isNotBlank()) { "Character slug must not be blank" }
    }
}

enum class CharacterNameType {
    PRIMARY,
    ALIAS,
    EPITHET,
}

data class CharacterName(
    val id: UUID,
    val characterId: UUID,
    val type: CharacterNameType,
    val translations: Map<String, String>,
    val window: TemporalWindow,
    val sourceIds: Set<UUID> = emptySet(),
) {
    init {
        require(translations.isNotEmpty()) { "Character name must have at least one translation" }
        require(translations.keys.none(String::isBlank)) { "Character name locale must not be blank" }
        require(translations.values.none(String::isBlank)) { "Character name translation must not be blank" }
    }
}

enum class CharacterStatus {
    ALIVE,
    DEAD,
    UNKNOWN,
}

data class CharacterStatusRecord(
    val id: UUID,
    val characterId: UUID,
    val status: CharacterStatus,
    val window: TemporalWindow,
    val sourceIds: Set<UUID> = emptySet(),
)

data class CharacterProjection(
    val character: Character,
    val primaryName: CharacterName?,
    val aliases: List<CharacterName>,
    val epithets: List<CharacterName>,
    val status: CharacterStatusRecord?,
)

class CharacterProjectionEngine(
    private val temporalProjectionEngine: TemporalProjectionEngine = TemporalProjectionEngine(),
) {
    fun project(
        character: Character,
        names: Iterable<CharacterName>,
        statuses: Iterable<CharacterStatusRecord>,
        context: ProjectionContext,
    ): CharacterProjection {
        val characterNames = names.toList()
        val characterStatuses = statuses.toList()

        require(characterNames.all { it.characterId == character.id }) {
            "Every character name must belong to the projected character"
        }
        require(characterStatuses.all { it.characterId == character.id }) {
            "Every character status must belong to the projected character"
        }

        val visibleNames =
            temporalProjectionEngine
                .visibleFacts(characterNames.map { TemporalFact(it, it.window) }, context)
                .map { it.value }

        val primaryName =
            temporalProjectionEngine
                .projectSingle(
                    characterNames
                        .filter { it.type == CharacterNameType.PRIMARY }
                        .map { TemporalFact(it, it.window) },
                    context,
                )
                ?.value

        val status =
            temporalProjectionEngine
                .projectSingle(characterStatuses.map { TemporalFact(it, it.window) }, context)
                ?.value

        return CharacterProjection(
            character = character,
            primaryName = primaryName,
            aliases = visibleNames.filter { it.type == CharacterNameType.ALIAS },
            epithets = visibleNames.filter { it.type == CharacterNameType.EPITHET },
            status = status,
        )
    }
}
