package com.dendenapi.domain.temporal

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class TemporalProjectionEngineTest {
    @Test
    fun `chapter numbers must be positive`() {
        assertFailsWith<IllegalArgumentException> { chapter(0) }
        assertFailsWith<IllegalArgumentException> { chapter(-1) }
    }

    @Test
    fun `request chapters must not exceed the dataset maximum`() {
        assertFailsWith<IllegalArgumentException> {
            ProjectionContext(maxIngestedChapter = chapter(100), asOfChapter = chapter(101))
        }
        assertFailsWith<IllegalArgumentException> {
            ProjectionContext(maxIngestedChapter = chapter(100), maxChapter = chapter(101))
        }
    }

    @Test
    fun `omitted controls select the latest ingested view`() {
        val context = ProjectionContext(maxIngestedChapter = chapter(100))

        assertEquals(chapter(100), context.effectiveAsOfChapter)
        assertEquals(chapter(100), context.effectiveMaxChapter)
        assertTrue(engine.isVisible(window(from = 100, available = 100), context))
    }

    @Test
    fun `validity bounds are inclusive`() {
        val fact = window(from = 20, to = 30, available = 10)

        assertTrue(engine.isVisible(fact, context(asOf = 20)))
        assertTrue(engine.isVisible(fact, context(asOf = 30)))
        assertFalse(engine.isVisible(fact, context(asOf = 19)))
        assertFalse(engine.isVisible(fact, context(asOf = 31)))
    }

    @Test
    fun `unknown validity bounds cannot exclude a fact`() {
        assertTrue(engine.isVisible(window(to = 20, available = 1), context(asOf = 1)))
        assertTrue(engine.isVisible(window(from = 80, available = 1), context(asOf = 100)))
        assertTrue(engine.isVisible(window(available = 1), context(asOf = 50)))
    }

    @Test
    fun `story validity and reader availability are independent`() {
        val lateReveal = window(from = 50, available = 80)

        assertFalse(engine.isVisible(lateReveal, context(asOf = 70, max = 70)))
        assertTrue(engine.isVisible(lateReveal, context(asOf = 70, max = 80)))
        assertFalse(engine.isVisible(lateReveal, context(asOf = 40, max = 80)))
    }

    @Test
    fun `later story state remains spoiler safe when as of exceeds max`() {
        val context = context(asOf = 90, max = 60)

        assertTrue(engine.isVisible(window(from = 80, available = 50), context))
        assertFalse(engine.isVisible(window(from = 80, available = 70), context))
    }

    @Test
    fun `collection filtering preserves input order`() {
        val facts =
            listOf(
                fact("first", from = 1, available = 1),
                fact("hidden", from = 21, available = 90),
                fact("second", from = 21, available = 30),
            )

        assertEquals(
            listOf("first", "second"),
            engine.visibleFacts(facts, context(asOf = 50, max = 50)).map { it.value },
        )
    }

    @Test
    fun `single valued projection returns no fact when none is visible`() {
        val result = engine.projectSingle(listOf(fact("hidden", available = 80)), context(max = 70))

        assertNull(result)
    }

    @Test
    fun `single valued projection does not substitute an obsolete fact for a hidden current fact`() {
        val facts =
            listOf(
                fact("obsolete", from = 1, to = 49, available = 1),
                fact("current but hidden", from = 50, available = 80),
            )

        assertNull(engine.projectSingle(facts, context(asOf = 70, max = 70)))
    }

    @Test
    fun `single valued projection rejects multiple visible facts`() {
        val facts = listOf(fact("one", available = 1), fact("two", available = 1))

        assertFailsWith<IllegalStateException> {
            engine.projectSingle(facts, context())
        }
    }

    @Test
    fun `known interval end cannot precede its start`() {
        assertFailsWith<IllegalArgumentException> {
            window(from = 20, to = 19, available = 1)
        }
    }

    private fun context(
        asOf: Int? = null,
        max: Int? = null,
    ) = ProjectionContext(
        maxIngestedChapter = chapter(100),
        asOfChapter = asOf?.let(::chapter),
        maxChapter = max?.let(::chapter),
    )

    private fun window(
        from: Int? = null,
        to: Int? = null,
        available: Int,
    ) = TemporalWindow(
        validFromChapter = from?.let(::chapter),
        validToChapter = to?.let(::chapter),
        availableFromChapter = chapter(available),
    )

    private fun fact(
        value: String,
        from: Int? = null,
        to: Int? = null,
        available: Int,
    ) = TemporalFact(value, window(from, to, available))

    private fun chapter(value: Int) = ChapterNumber(value)

    private companion object {
        val engine = TemporalProjectionEngine()
    }
}
