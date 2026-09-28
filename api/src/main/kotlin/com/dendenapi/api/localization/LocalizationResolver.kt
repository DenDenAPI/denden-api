package com.dendenapi.api.localization

import java.util.IllformedLocaleException
import java.util.Locale

class InvalidLanguageTagException(languageTag: String, cause: Throwable? = null) :
    IllegalArgumentException("Invalid BCP 47 language tag: $languageTag", cause)

class LanguagePreference internal constructor(val fallbackLocales: List<String>)

data class LocalizedValue<T>(val value: T, val locale: String)

class LocalizationResolver(supportedLocales: Set<String>) {
    private val supportedByKey: Map<String, String> =
        supportedLocales
            .map { parseLanguageTag(it).toLanguageTag() }
            .associateBy(::localeKey)

    init {
        require(supportedByKey.size == supportedLocales.size) {
            "Supported locales must not contain duplicate tags"
        }
        require(ENGLISH_KEY in supportedByKey) {
            "English (en) must be included as the fallback locale"
        }
    }

    fun resolvePreference(
        explicitLanguage: String?,
        acceptedLanguages: List<String>,
    ): LanguagePreference {
        if (explicitLanguage != null) {
            val explicitLocale = parseLanguageTag(explicitLanguage)
            if (matchSupportedLocale(explicitLocale) == null) {
                return LanguagePreference(listOf(ENGLISH))
            }
            return LanguagePreference(fallbackChain(explicitLocale))
        }

        for (acceptedLanguage in acceptedLanguages) {
            val acceptedLocale = parseLanguageTag(acceptedLanguage)
            if (matchSupportedLocale(acceptedLocale) == null) continue
            return LanguagePreference(fallbackChain(acceptedLocale))
        }

        return LanguagePreference(listOf(ENGLISH))
    }

    fun <T> resolveField(
        preference: LanguagePreference,
        translations: Map<String, T>,
    ): LocalizedValue<T>? {
        val translationsByKey = translations.entries.associate { (locale, value) ->
            val canonicalLocale = parseLanguageTag(locale)
            val key = localeKey(canonicalLocale)
            require(key in supportedByKey) { "Translation locale is not supported: $locale" }
            key to (supportedByKey.getValue(key) to value)
        }
        require(translationsByKey.size == translations.size) {
            "Translations must not contain duplicate locale tags"
        }

        for (locale in preference.fallbackLocales) {
            val localizedValue = translationsByKey[localeKey(locale)] ?: continue
            return LocalizedValue(localizedValue.second, localizedValue.first)
        }

        return null
    }

    fun contentLanguages(
        preference: LanguagePreference,
        usedLocales: Iterable<String>,
    ): List<String> {
        val usedLocaleKeys = usedLocales.map(::localeKey).toSet()
        return preference.fallbackLocales
            .filter { localeKey(it) in usedLocaleKeys }
            .distinctBy(::localeKey)
    }

    private fun matchSupportedLocale(locale: Locale): String? {
        val exact = supportedByKey[localeKey(locale)]
        if (exact != null) return exact

        return supportedByKey[locale.language.lowercase(Locale.ROOT)]
    }

    private fun fallbackChain(requestedLocale: Locale): List<String> =
        buildList {
            val exact = supportedByKey[localeKey(requestedLocale)]
            if (exact != null) add(exact)

            val baseLanguage = supportedByKey[requestedLocale.language.lowercase(Locale.ROOT)]
            if (baseLanguage != null && none { localeKey(it) == localeKey(baseLanguage) }) {
                add(baseLanguage)
            }

            if (none { localeKey(it) == ENGLISH_KEY }) add(ENGLISH)
        }

    private fun localeKey(languageTag: String): String =
        localeKey(parseLanguageTag(languageTag))

    private fun localeKey(locale: Locale): String = locale.toLanguageTag().lowercase(Locale.ROOT)

    private fun parseLanguageTag(languageTag: String): Locale =
        try {
            Locale.Builder().setLanguageTag(languageTag).build()
        } catch (exception: IllformedLocaleException) {
            throw InvalidLanguageTagException(languageTag, exception)
        }

    private companion object {
        const val ENGLISH = "en"
        const val ENGLISH_KEY = "en"
    }
}
