package com.dendenapi.application.character

import com.dendenapi.domain.character.Character
import com.dendenapi.domain.character.CharacterName
import com.dendenapi.domain.character.CharacterNameType
import com.dendenapi.domain.character.CharacterStatus
import com.dendenapi.domain.character.CharacterStatusRecord
import com.dendenapi.domain.temporal.ChapterNumber
import com.dendenapi.domain.temporal.ProjectionContext
import com.dendenapi.domain.temporal.TemporalWindow
import java.util.UUID
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull

class GetCharacterTest {
    @Test
    fun `loads a character by stable slug and returns its domain projection`() {
        val character = character("test-character")
        val reader = RecordingCharacterReader(aggregate(character))
        val useCase = GetCharacter(reader)

        val result = useCase("test-character", context(asOf = 50, max = 50))

        assertEquals("test-character", reader.requestedSlug)
        assertEquals(character, result?.character)
        assertEquals("Current name", result?.primaryName?.translations?.get("en"))
        assertEquals(CharacterStatus.ALIVE, result?.status?.status)
    }

    @Test
    fun `returns no projection when the character does not exist`() {
        val reader = RecordingCharacterReader(null)

        assertNull(GetCharacter(reader)("missing", context()))
        assertEquals("missing", reader.requestedSlug)
    }

    @Test
    fun `uses the supplied spoiler cap without substituting obsolete facts`() {
        val character = character("spoiler-safe")
        val reader = RecordingCharacterReader(aggregate(character))

        val result = GetCharacter(reader)("spoiler-safe", context(asOf = 50, max = 30))

        assertNull(result?.primaryName)
        assertNull(result?.status)
    }

    @Test
    fun `uses the supplied story point instead of the latest view`() {
        val character = character("historical-view")
        val reader = RecordingCharacterReader(aggregate(character))

        val result = GetCharacter(reader)("historical-view", context(asOf = 10, max = 100))

        assertEquals("Old name", result?.primaryName?.translations?.get("en"))
        assertEquals(CharacterStatus.UNKNOWN, result?.status?.status)
    }

    @Test
    fun `rejects a blank slug before calling the port`() {
        val reader = RecordingCharacterReader(null)

        assertFailsWith<IllegalArgumentException> {
            GetCharacter(reader)(" ", context())
        }
        assertFalse(reader.wasCalled)
    }

    @Test
    fun `does not swallow domain invariant failures`() {
        val character = character("invalid-history")
        val aggregate =
            CharacterAggregate(
                character = character,
                names =
                    listOf(
                        name(character, "One", from = 1, available = 1),
                        name(character, "Two", from = 1, available = 1),
                    ),
                statuses = emptyList(),
            )

        assertFailsWith<IllegalStateException> {
            GetCharacter(RecordingCharacterReader(aggregate))("invalid-history", context())
        }
    }

    private fun aggregate(character: Character) =
        CharacterAggregate(
            character = character,
            names =
                listOf(
                    name(character, "Old name", from = 1, to = 20, available = 1),
                    name(character, "Current name", from = 21, available = 40),
                ),
            statuses =
                listOf(
                    status(character, CharacterStatus.UNKNOWN, from = 1, to = 20, available = 1),
                    status(character, CharacterStatus.ALIVE, from = 21, available = 40),
                ),
        )

    private fun character(slug: String) = Character(UUID.randomUUID(), slug)

    private fun name(
        character: Character,
        value: String,
        from: Int,
        to: Int? = null,
        available: Int,
    ) = CharacterName(
        id = UUID.randomUUID(),
        characterId = character.id,
        type = CharacterNameType.PRIMARY,
        translations = mapOf("en" to value),
        window = window(from, to, available),
    )

    private fun status(
        character: Character,
        value: CharacterStatus,
        from: Int,
        to: Int? = null,
        available: Int,
    ) = CharacterStatusRecord(
        id = UUID.randomUUID(),
        characterId = character.id,
        status = value,
        window = window(from, to, available),
    )

    private fun window(from: Int, to: Int?, available: Int) =
        TemporalWindow(
            validFromChapter = ChapterNumber(from),
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

    private class RecordingCharacterReader(private val result: CharacterAggregate?) : CharacterReader {
        var requestedSlug: String? = null
            private set

        val wasCalled: Boolean
            get() = requestedSlug != null

        override fun findBySlug(slug: String): CharacterAggregate? {
            requestedSlug = slug
            return result
        }
    }
}
