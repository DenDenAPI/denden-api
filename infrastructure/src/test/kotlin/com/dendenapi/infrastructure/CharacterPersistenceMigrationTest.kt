package com.dendenapi.infrastructure

import java.sql.Connection
import java.sql.DriverManager
import java.sql.SQLException
import java.util.UUID
import org.flywaydb.core.Flyway
import org.junit.jupiter.api.Test
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers
import org.testcontainers.postgresql.PostgreSQLContainer
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

@Testcontainers
class CharacterPersistenceMigrationTest {
    @Test
    fun `migration creates character name status and evidence schema with relational constraints`() {
        val flyway =
            Flyway.configure()
                .dataSource(postgres.jdbcUrl, postgres.username, postgres.password)
                .locations("classpath:db/migration")
                .load()

        assertEquals(2, flyway.migrate().migrationsExecuted)
        assertEquals(0, flyway.migrate().migrationsExecuted)

        DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
            val records = insertFoundationRecords(connection)
            verifyValidCharacterRecords(connection, records)
            verifyCharacterConstraints(connection, records)
            verifyTemporalConstraints(connection, records)
            verifyEvidenceConstraints(connection, records)
        }
    }

    private fun insertFoundationRecords(connection: Connection): Records {
        val chapters = listOf(1, 10, 20, 30, 40, 100).associateWith { UUID.randomUUID() }
        chapters.forEach { (number, id) ->
            connection.prepareStatement(
                "INSERT INTO chapter (id, number, cover_type) VALUES (?, ?, 'STANDARD')",
            ).use {
                it.setObject(1, id)
                it.setInt(2, number)
                it.executeUpdate()
            }
        }

        val sourceId = UUID.randomUUID()
        connection.prepareStatement(
            "INSERT INTO source (id, type, chapter_id) VALUES (?, 'MANGA_CHAPTER', ?)",
        ).use {
            it.setObject(1, sourceId)
            it.setObject(2, chapters.getValue(1))
            it.executeUpdate()
        }

        return Records(chapters = chapters, sourceId = sourceId)
    }

    private fun verifyValidCharacterRecords(connection: Connection, records: Records) {
        val characterId = UUID.randomUUID()
        connection.prepareStatement(
            """
            INSERT INTO character (id, slug, first_mention_chapter_id, first_appearance_chapter_id)
            VALUES (?, ?, ?, ?)
            """.trimIndent(),
        ).use {
            it.setObject(1, characterId)
            it.setString(2, "test-character")
            it.setObject(3, records.chapters.getValue(1))
            it.setObject(4, records.chapters.getValue(10))
            it.executeUpdate()
        }

        val primaryNameId = insertName(connection, characterId, "PRIMARY", 1, 20, 1)
        insertName(connection, characterId, "PRIMARY", 30, null, 30)
        val aliasId = insertName(connection, characterId, "ALIAS", 1, null, 10)
        insertName(connection, characterId, "ALIAS", 10, 40, 10)

        insertNameTranslation(connection, primaryNameId, "en", "English name")
        insertNameTranslation(connection, primaryNameId, "es", "Spanish name")

        val aliveStatusId = insertStatus(connection, characterId, "ALIVE", 1, 20, 1)
        insertStatus(connection, characterId, "UNKNOWN", 30, null, 40)

        insertNameSource(connection, primaryNameId, records.sourceId)
        insertNameSource(connection, aliasId, records.sourceId)
        insertStatusSource(connection, aliveStatusId, records.sourceId)

        connection.prepareStatement(
            "SELECT locale, value FROM character_name_translation WHERE character_name_id = ? ORDER BY locale",
        ).use { statement ->
            statement.setObject(1, primaryNameId)
            statement.executeQuery().use { resultSet ->
                val translations = mutableListOf<Pair<String, String>>()
                while (resultSet.next()) {
                    translations += resultSet.getString("locale") to resultSet.getString("value")
                }
                assertEquals(listOf("en" to "English name", "es" to "Spanish name"), translations)
            }
        }

        records.characterId = characterId
        records.primaryNameId = primaryNameId
        records.aliveStatusId = aliveStatusId
    }

    private fun verifyCharacterConstraints(connection: Connection, records: Records) {
        assertSqlFailure {
            insertCharacter(connection, UUID.randomUUID(), "test-character")
        }
        assertSqlFailure {
            insertCharacter(connection, UUID.randomUUID(), "   ")
        }
        assertSqlFailure {
            connection.prepareStatement(
                "INSERT INTO character (id, slug, first_mention_chapter_id) VALUES (?, ?, ?)",
            ).use {
                it.setObject(1, UUID.randomUUID())
                it.setString(2, "missing-chapter")
                it.setObject(3, UUID.randomUUID())
                it.executeUpdate()
            }
        }
        assertSqlFailure {
            insertName(connection, records.characterId, "UNDOCUMENTED", 1, 10, 1)
        }
        assertSqlFailure {
            insertStatus(connection, records.characterId, "MISSING", 1, 10, 1)
        }
        assertSqlFailure {
            insertNameTranslation(connection, records.primaryNameId, "en", "Duplicate locale")
        }
        assertSqlFailure {
            insertName(connection, records.characterId, "ALIAS", 1, 10, 99)
        }
    }

    private fun verifyTemporalConstraints(connection: Connection, records: Records) {
        assertSqlFailure {
            insertName(connection, records.characterId, "PRIMARY", 20, 10, 1)
        }
        assertSqlFailure {
            insertStatus(connection, records.characterId, "ALIVE", 20, 10, 1)
        }
        assertSqlFailure {
            insertName(connection, records.characterId, "PRIMARY", 10, 30, 10)
        }
        assertSqlFailure {
            insertStatus(connection, records.characterId, "DEAD", 10, 30, 20)
        }

        val secondCharacterId = UUID.randomUUID()
        insertCharacter(connection, secondCharacterId, "unknown-bounds")
        insertName(connection, secondCharacterId, "PRIMARY", null, null, 1)
        assertSqlFailure {
            insertName(connection, secondCharacterId, "PRIMARY", 40, 100, 40)
        }
        insertStatus(connection, secondCharacterId, "UNKNOWN", null, null, 1)
        assertSqlFailure {
            insertStatus(connection, secondCharacterId, "ALIVE", 40, 100, 40)
        }
    }

    private fun verifyEvidenceConstraints(connection: Connection, records: Records) {
        assertSqlFailure {
            insertNameSource(connection, records.primaryNameId, records.sourceId)
        }
        assertSqlFailure {
            insertNameSource(connection, UUID.randomUUID(), records.sourceId)
        }
        assertSqlFailure {
            insertStatusSource(connection, records.aliveStatusId, UUID.randomUUID())
        }
    }

    private fun insertCharacter(connection: Connection, id: UUID, slug: String) {
        connection.prepareStatement("INSERT INTO character (id, slug) VALUES (?, ?)").use {
            it.setObject(1, id)
            it.setString(2, slug)
            it.executeUpdate()
        }
    }

    private fun insertName(
        connection: Connection,
        characterId: UUID,
        type: String,
        validFrom: Int?,
        validTo: Int?,
        availableFrom: Int,
    ): UUID =
        UUID.randomUUID().also { id ->
            connection.prepareStatement(
                """
                INSERT INTO character_name (
                    id, character_id, type, valid_from_chapter, valid_to_chapter, available_from_chapter
                ) VALUES (?, ?, ?, ?, ?, ?)
                """.trimIndent(),
            ).use {
                it.setObject(1, id)
                it.setObject(2, characterId)
                it.setString(3, type)
                it.setNullableInt(4, validFrom)
                it.setNullableInt(5, validTo)
                it.setInt(6, availableFrom)
                it.executeUpdate()
            }
        }

    private fun insertStatus(
        connection: Connection,
        characterId: UUID,
        status: String,
        validFrom: Int?,
        validTo: Int?,
        availableFrom: Int,
    ): UUID =
        UUID.randomUUID().also { id ->
            connection.prepareStatement(
                """
                INSERT INTO character_status_record (
                    id, character_id, status, valid_from_chapter, valid_to_chapter, available_from_chapter
                ) VALUES (?, ?, ?, ?, ?, ?)
                """.trimIndent(),
            ).use {
                it.setObject(1, id)
                it.setObject(2, characterId)
                it.setString(3, status)
                it.setNullableInt(4, validFrom)
                it.setNullableInt(5, validTo)
                it.setInt(6, availableFrom)
                it.executeUpdate()
            }
        }

    private fun insertNameTranslation(connection: Connection, nameId: UUID, locale: String, value: String) {
        connection.prepareStatement(
            "INSERT INTO character_name_translation (character_name_id, locale, value) VALUES (?, ?, ?)",
        ).use {
            it.setObject(1, nameId)
            it.setString(2, locale)
            it.setString(3, value)
            it.executeUpdate()
        }
    }

    private fun insertNameSource(connection: Connection, nameId: UUID, sourceId: UUID) {
        connection.prepareStatement(
            "INSERT INTO character_name_source (character_name_id, source_id) VALUES (?, ?)",
        ).use {
            it.setObject(1, nameId)
            it.setObject(2, sourceId)
            it.executeUpdate()
        }
    }

    private fun insertStatusSource(connection: Connection, statusId: UUID, sourceId: UUID) {
        connection.prepareStatement(
            """
            INSERT INTO character_status_record_source (character_status_record_id, source_id)
            VALUES (?, ?)
            """.trimIndent(),
        ).use {
            it.setObject(1, statusId)
            it.setObject(2, sourceId)
            it.executeUpdate()
        }
    }

    private fun java.sql.PreparedStatement.setNullableInt(index: Int, value: Int?) {
        if (value == null) {
            setNull(index, java.sql.Types.INTEGER)
        } else {
            setInt(index, value)
        }
    }

    private fun assertSqlFailure(block: () -> Unit) {
        assertFailsWith<SQLException>(block = block)
    }

    private data class Records(
        val chapters: Map<Int, UUID>,
        val sourceId: UUID,
        var characterId: UUID = UUID.randomUUID(),
        var primaryNameId: UUID = UUID.randomUUID(),
        var aliveStatusId: UUID = UUID.randomUUID(),
    )

    companion object {
        @Container
        @JvmStatic
        val postgres = PostgreSQLContainer("postgres:18-alpine")
    }
}
