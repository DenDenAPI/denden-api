package com.dendenapi.domain.character

import com.dendenapi.domain.temporal.ChapterNumber
import com.dendenapi.domain.temporal.ProjectionContext
import com.dendenapi.domain.temporal.TemporalWindow
import java.util.UUID
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull

class CharacterProjectionEngineTest {
    @Test
    fun `projects visible names and status at the selected story point`() {
        val character = character()
        val names =
            listOf(
                name(character, "Old primary", CharacterNameType.PRIMARY, from = 1, to = 20, available = 1),
                name(character, "Current primary", CharacterNameType.PRIMARY, from = 21, available = 21),
                name(character, "First alias", CharacterNameType.ALIAS, from = 1, available = 10),
                name(character, "Hidden alias", CharacterNameType.ALIAS, from = 1, available = 80),
                name(character, "Second alias", CharacterNameType.ALIAS, from = 20, available = 20),
                name(character, "Epithet", CharacterNameType.EPITHET, from = 30, available = 30),
            )
        val statuses =
            listOf(
                status(character, CharacterStatus.UNKNOWN, from = 1, to = 20, available = 1),
                status(character, CharacterStatus.ALIVE, from = 21, available = 21),
            )

        val projection = engine.project(character, names, statuses, context(asOf = 50, max = 50))

        assertEquals("Current primary", projection.primaryName?.translations?.get("en"))
        assertEquals(listOf("First alias", "Second alias"), projection.aliases.map { it.translations.getValue("en") })
        assertEquals(listOf("Epithet"), projection.epithets.map { it.translations.getValue("en") })
        assertEquals(CharacterStatus.ALIVE, projection.status?.status)
    }

    @Test
    fun `does not substitute obsolete facts when current facts are spoiler hidden`() {
        val character = character()
        val names =
            listOf(
                name(character, "Old primary", CharacterNameType.PRIMARY, from = 1, to = 20, available = 1),
                name(character, "Hidden current", CharacterNameType.PRIMARY, from = 21, available = 80),
            )
        val statuses =
            listOf(
                status(character, CharacterStatus.UNKNOWN, from = 1, to = 20, available = 1),
                status(character, CharacterStatus.ALIVE, from = 21, available = 80),
            )

        val projection = engine.project(character, names, statuses, context(asOf = 50, max = 50))

        assertNull(projection.primaryName)
        assertNull(projection.status)
    }

    @Test
    fun `inclusive temporal bounds apply to character facts`() {
        val character = character()
        val boundedName = name(character, "Bounded", CharacterNameType.PRIMARY, from = 20, to = 30, available = 20)

        assertEquals(
            "Bounded",
            engine.project(character, listOf(boundedName), emptyList(), context(asOf = 20)).primaryName?.translations?.get("en"),
        )
        assertEquals(
            "Bounded",
            engine.project(character, listOf(boundedName), emptyList(), context(asOf = 30)).primaryName?.translations?.get("en"),
        )
    }

    @Test
    fun `rejects facts owned by another character`() {
        val character = character()
        val anotherCharacter = character(slug = "another")

        assertFailsWith<IllegalArgumentException> {
            engine.project(
                character,
                listOf(name(anotherCharacter, "Wrong owner", CharacterNameType.PRIMARY)),
                emptyList(),
                context(),
            )
        }
        assertFailsWith<IllegalArgumentException> {
            engine.project(
                character,
                emptyList(),
                listOf(status(anotherCharacter, CharacterStatus.ALIVE)),
                context(),
            )
        }
    }

    @Test
    fun `rejects multiple visible primary names and statuses`() {
        val character = character()

        assertFailsWith<IllegalStateException> {
            engine.project(
                character,
                listOf(
                    name(character, "One", CharacterNameType.PRIMARY),
                    name(character, "Two", CharacterNameType.PRIMARY),
                ),
                emptyList(),
                context(),
            )
        }
        assertFailsWith<IllegalStateException> {
            engine.project(
                character,
                emptyList(),
                listOf(
                    status(character, CharacterStatus.ALIVE),
                    status(character, CharacterStatus.UNKNOWN),
                ),
                context(),
            )
        }
    }

    @Test
    fun `validates character slugs and name translations`() {
        assertFailsWith<IllegalArgumentException> { character(slug = " ") }

        val character = character()
        assertFailsWith<IllegalArgumentException> {
            name(character, "ignored", CharacterNameType.PRIMARY, translations = emptyMap())
        }
        assertFailsWith<IllegalArgumentException> {
            name(character, "ignored", CharacterNameType.PRIMARY, translations = mapOf("" to "Name"))
        }
        assertFailsWith<IllegalArgumentException> {
            name(character, "ignored", CharacterNameType.PRIMARY, translations = mapOf("en" to " "))
        }
    }

    private fun character(slug: String = "test-character") = Character(UUID.randomUUID(), slug)

    private fun name(
        character: Character,
        englishValue: String,
        type: CharacterNameType,
        from: Int? = null,
        to: Int? = null,
        available: Int = 1,
        translations: Map<String, String> = mapOf("en" to englishValue),
    ) = CharacterName(
        id = UUID.randomUUID(),
        characterId = character.id,
        type = type,
        translations = translations,
        window = window(from, to, available),
    )

    private fun status(
        character: Character,
        value: CharacterStatus,
        from: Int? = null,
        to: Int? = null,
        available: Int = 1,
    ) = CharacterStatusRecord(
        id = UUID.randomUUID(),
        characterId = character.id,
        status = value,
        window = window(from, to, available),
    )

    private fun window(from: Int?, to: Int?, available: Int) =
        TemporalWindow(
            validFromChapter = from?.let(::ChapterNumber),
            validToChapter = to?.let(::ChapterNumber),
            availableFromChapter = ChapterNumber(available),
        )

    private fun context(
        asOf: Int? = null,
        max: Int? = null,
    ) = ProjectionContext(
        maxIngestedChapter = ChapterNumber(100),
        asOfChapter = asOf?.let(::ChapterNumber),
        maxChapter = max?.let(::ChapterNumber),
    )

    private companion object {
        val engine = CharacterProjectionEngine()
    }
}
