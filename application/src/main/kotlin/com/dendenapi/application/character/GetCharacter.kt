package com.dendenapi.application.character

import com.dendenapi.domain.character.Character
import com.dendenapi.domain.character.CharacterName
import com.dendenapi.domain.character.CharacterProjection
import com.dendenapi.domain.character.CharacterProjectionEngine
import com.dendenapi.domain.character.CharacterStatusRecord
import com.dendenapi.domain.temporal.ProjectionContext

data class CharacterAggregate(
    val character: Character,
    val names: List<CharacterName>,
    val statuses: List<CharacterStatusRecord>,
)

fun interface CharacterReader {
    fun findBySlug(slug: String): CharacterAggregate?
}

class GetCharacter(
    private val characterReader: CharacterReader,
    private val projectionEngine: CharacterProjectionEngine = CharacterProjectionEngine(),
) {
    operator fun invoke(
        slug: String,
        context: ProjectionContext,
    ): CharacterProjection? {
        require(slug.isNotBlank()) { "Character slug must not be blank" }

        val aggregate = characterReader.findBySlug(slug) ?: return null

        return projectionEngine.project(
            character = aggregate.character,
            names = aggregate.names,
            statuses = aggregate.statuses,
            context = context,
        )
    }
}
