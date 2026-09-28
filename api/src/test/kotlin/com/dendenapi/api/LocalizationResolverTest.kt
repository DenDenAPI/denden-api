package com.dendenapi.api

import com.dendenapi.api.localization.InvalidLanguageTagException
import com.dendenapi.api.localization.LocalizationResolver
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull

class LocalizationResolverTest {
    @Test
    fun `explicit language overrides accepted language preferences`() {
        val preference = resolver.resolvePreference(explicitLanguage = "es", acceptedLanguages = listOf("fr"))

        assertEquals(listOf("es", "en"), preference.fallbackLocales)
    }

    @Test
    fun `unsupported explicit language falls back to English without using accepted preferences`() {
        val preference = resolver.resolvePreference(explicitLanguage = "ja", acceptedLanguages = listOf("es"))

        assertEquals(listOf("en"), preference.fallbackLocales)
    }

    @Test
    fun `accepted preferences are considered in order with exact and base matching`() {
        val preference = resolver.resolvePreference(
            explicitLanguage = null,
            acceptedLanguages = listOf("fr-CA", "es-MX"),
        )

        assertEquals(listOf("fr", "en"), preference.fallbackLocales)
    }

    @Test
    fun `exact regional translation is preferred before its base language`() {
        val preference = regionalResolver.resolvePreference("es-MX", emptyList())

        assertEquals(listOf("es-MX", "es", "en"), preference.fallbackLocales)
        assertEquals(
            "Regional title",
            regionalResolver.resolveField(
                preference,
                mapOf("es" to "Spanish title", "es-MX" to "Regional title", "en" to "English title"),
            )?.value,
        )
    }

    @Test
    fun `field falls back to English when the preferred translation is missing`() {
        val preference = resolver.resolvePreference("es", emptyList())
        val value = resolver.resolveField(preference, mapOf("en" to "English title"))

        assertEquals("English title", value?.value)
        assertEquals("en", value?.locale)
    }

    @Test
    fun `locale matching is case insensitive and returns the canonical supported tag`() {
        val preference = resolver.resolvePreference("ES", emptyList())
        val value = resolver.resolveField(preference, mapOf("Es" to "Título", "en" to "Title"))

        assertEquals("es", value?.locale)
        assertEquals("Título", value?.value)
    }

    @Test
    fun `missing optional translation after fallback remains absent`() {
        val preference = resolver.resolvePreference("es", emptyList())

        assertNull(resolver.resolveField(preference, emptyMap<String, String>()))
    }

    @Test
    fun `content languages list only used locales in fallback order without duplicates`() {
        val preference = resolver.resolvePreference("es", emptyList())

        assertEquals(listOf("es", "en"), resolver.contentLanguages(preference, listOf("en", "es", "en")))
        assertEquals(listOf("es"), resolver.contentLanguages(preference, listOf("es")))
    }

    @Test
    fun `malformed and comma separated explicit language tags are rejected`() {
        assertFailsWith<InvalidLanguageTagException> {
            resolver.resolvePreference("es,en", emptyList())
        }
        assertFailsWith<InvalidLanguageTagException> {
            resolver.resolvePreference("es_ES", emptyList())
        }
    }

    private companion object {
        val resolver = LocalizationResolver(setOf("en", "es", "fr"))
        val regionalResolver = LocalizationResolver(setOf("en", "es", "es-MX"))
    }
}
