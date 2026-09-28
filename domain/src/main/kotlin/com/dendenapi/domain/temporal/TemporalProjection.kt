package com.dendenapi.domain.temporal

@JvmInline
value class ChapterNumber(val value: Int) : Comparable<ChapterNumber> {
    init {
        require(value > 0) { "Chapter number must be positive" }
    }

    override fun compareTo(other: ChapterNumber): Int = value.compareTo(other.value)
}

data class ProjectionContext(
    val maxIngestedChapter: ChapterNumber,
    val asOfChapter: ChapterNumber? = null,
    val maxChapter: ChapterNumber? = null,
) {
    init {
        require(asOfChapter == null || asOfChapter <= maxIngestedChapter) {
            "asOfChapter must not exceed maxIngestedChapter"
        }
        require(maxChapter == null || maxChapter <= maxIngestedChapter) {
            "maxChapter must not exceed maxIngestedChapter"
        }
    }

    val effectiveAsOfChapter: ChapterNumber = asOfChapter ?: maxIngestedChapter
    val effectiveMaxChapter: ChapterNumber = maxChapter ?: maxIngestedChapter
}

data class TemporalWindow(
    val validFromChapter: ChapterNumber? = null,
    val validToChapter: ChapterNumber? = null,
    val availableFromChapter: ChapterNumber,
) {
    init {
        require(validFromChapter == null || validToChapter == null || validToChapter >= validFromChapter) {
            "validToChapter must not precede validFromChapter"
        }
    }
}

data class TemporalFact<T>(
    val value: T,
    val window: TemporalWindow,
)

class TemporalProjectionEngine {
    fun isVisible(
        window: TemporalWindow,
        context: ProjectionContext,
    ): Boolean =
        (window.validFromChapter == null || window.validFromChapter <= context.effectiveAsOfChapter) &&
            (window.validToChapter == null || context.effectiveAsOfChapter <= window.validToChapter) &&
            window.availableFromChapter <= context.effectiveMaxChapter

    fun <T> visibleFacts(
        facts: Iterable<TemporalFact<T>>,
        context: ProjectionContext,
    ): List<TemporalFact<T>> = facts.filter { isVisible(it.window, context) }

    fun <T> projectSingle(
        facts: Iterable<TemporalFact<T>>,
        context: ProjectionContext,
    ): TemporalFact<T>? = visibleFacts(facts, context).singleOrNullOrThrow()

    private fun <T> List<T>.singleOrNullOrThrow(): T? =
        when (size) {
            0 -> null
            1 -> single()
            else -> error("Multiple visible facts violate the single-valued projection invariant")
        }
}
