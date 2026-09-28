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
class PersistenceFoundationMigrationTest {
    @Test
    fun `migration creates publication and source schema with relational constraints`() {
        val flyway =
            Flyway.configure()
                .dataSource(postgres.jdbcUrl, postgres.username, postgres.password)
                .locations("classpath:db/migration")
                .load()

        assertEquals(2, flyway.migrate().migrationsExecuted)
        assertEquals(0, flyway.migrate().migrationsExecuted)

        DriverManager.getConnection(postgres.jdbcUrl, postgres.username, postgres.password).use { connection ->
            val records = verifyValidRecordsAndTranslations(connection)
            verifyConstraints(connection, records.first, records.second)
        }
    }

    private fun verifyValidRecordsAndTranslations(connection: Connection): Pair<UUID, UUID> {
        val volumeId = UUID.randomUUID()
        val chapterId = UUID.randomUUID()
        val secondChapterId = UUID.randomUUID()
        val sourceId = UUID.randomUUID()
        val volumeSourceId = UUID.randomUUID()

        connection.prepareStatement("INSERT INTO volume (id, number) VALUES (?, ?)").use {
            it.setObject(1, volumeId)
            it.setInt(2, 1)
            it.executeUpdate()
        }
        connection.prepareStatement(
            "INSERT INTO volume_translation (volume_id, locale, title) VALUES (?, ?, ?)",
        ).use {
            it.setObject(1, volumeId)
            it.setString(2, "en")
            it.setString(3, "Volume title in English")
            it.executeUpdate()
        }
        connection.prepareStatement(
            "INSERT INTO volume_translation (volume_id, locale, title) VALUES (?, ?, ?)",
        ).use {
            it.setObject(1, volumeId)
            it.setString(2, "es")
            it.setString(3, "Volume title in Spanish")
            it.executeUpdate()
        }
        connection.prepareStatement(
            """
            INSERT INTO chapter (id, number, volume_id, page_count, cover_type)
            VALUES (?, ?, ?, ?, ?)
            """.trimIndent(),
        ).use {
            it.setObject(1, chapterId)
            it.setInt(2, 1)
            it.setObject(3, volumeId)
            it.setInt(4, 53)
            it.setString(5, "STANDARD")
            it.executeUpdate()
        }
        connection.prepareStatement(
            "INSERT INTO chapter (id, number, volume_id, cover_type) VALUES (?, ?, ?, ?)",
        ).use {
            it.setObject(1, secondChapterId)
            it.setInt(2, 2)
            it.setObject(3, volumeId)
            it.setString(4, "STANDARD")
            it.executeUpdate()
        }
        connection.prepareStatement(
            "INSERT INTO chapter_translation (chapter_id, locale, title) VALUES (?, ?, ?)",
        ).use {
            it.setObject(1, chapterId)
            it.setString(2, "en")
            it.setString(3, "Chapter title in English")
            it.executeUpdate()
        }
        connection.prepareStatement(
            "INSERT INTO chapter_translation (chapter_id, locale, title) VALUES (?, ?, ?)",
        ).use {
            it.setObject(1, chapterId)
            it.setString(2, "es")
            it.setString(3, "Chapter title in Spanish")
            it.executeUpdate()
        }
        connection.prepareStatement(
            "INSERT INTO chapter_translation (chapter_id, locale, title) VALUES (?, ?, ?)",
        ).use {
            it.setObject(1, secondChapterId)
            it.setString(2, "en")
            it.setString(3, "Second chapter title")
            it.executeUpdate()
        }
        connection.prepareStatement(
            """
            INSERT INTO source (id, type, chapter_id, locator)
            VALUES (?, ?, ?, ?)
            """.trimIndent(),
        ).use {
            it.setObject(1, sourceId)
            it.setString(2, "MANGA_CHAPTER")
            it.setObject(3, chapterId)
            it.setString(4, "chapter 1")
            it.executeUpdate()
        }
        connection.prepareStatement("INSERT INTO source (id, type, volume_id) VALUES (?, ?, ?)").use {
            it.setObject(1, volumeSourceId)
            it.setString(2, "SBS")
            it.setObject(3, volumeId)
            it.executeUpdate()
        }

        connection.prepareStatement(
            """
            SELECT chapter.number, chapter_translation.title
            FROM chapter
            JOIN chapter_translation ON chapter.id = chapter_translation.chapter_id
            WHERE chapter.volume_id = ? AND chapter_translation.locale = 'en'
            ORDER BY chapter.number
            """.trimIndent(),
        ).use { statement ->
            statement.setObject(1, volumeId)
            statement.executeQuery().use { resultSet ->
                val chapterNumbers = mutableListOf<Int>()
                val chapterTitles = mutableListOf<String>()
                while (resultSet.next()) {
                    chapterNumbers += resultSet.getInt("number")
                    chapterTitles += resultSet.getString("title")
                }
                assertEquals(listOf(1, 2), chapterNumbers)
                assertEquals(listOf("Chapter title in English", "Second chapter title"), chapterTitles)
            }
        }

        connection.prepareStatement(
            "SELECT indexname FROM pg_indexes WHERE tablename = 'chapter' AND indexname = ?",
        ).use { statement ->
            statement.setString(1, "chapter_volume_number_idx")
            statement.executeQuery().use { resultSet ->
                check(resultSet.next())
            }
        }

        return volumeId to chapterId
    }

    private fun verifyConstraints(connection: Connection, volumeId: UUID, chapterId: UUID) {
        val unusedId = UUID.randomUUID()
        val missingId = UUID.randomUUID()

        assertSqlFailure {
            connection.prepareStatement("INSERT INTO volume (id, number) VALUES (?, ?)").use {
                it.setObject(1, unusedId)
                it.setInt(2, 0)
                it.executeUpdate()
            }
        }
        assertSqlFailure {
            connection.prepareStatement("INSERT INTO volume (id, number) VALUES (?, ?)").use {
                it.setObject(1, unusedId)
                it.setInt(2, 1)
                it.executeUpdate()
            }
        }
        assertSqlFailure {
            connection.prepareStatement(
                "INSERT INTO volume_translation (volume_id, locale, title) VALUES (?, ?, ?)",
            ).use {
                it.setObject(1, volumeId)
                it.setString(2, "en")
                it.setString(3, "Duplicate locale")
                it.executeUpdate()
            }
        }
        assertSqlFailure {
            connection.prepareStatement(
                "INSERT INTO volume_translation (volume_id, locale, title) VALUES (?, ?, ?)",
            ).use {
                it.setObject(1, missingId)
                it.setString(2, "fr")
                it.setString(3, "Missing volume")
                it.executeUpdate()
            }
        }
        assertSqlFailure {
            connection.prepareStatement("INSERT INTO chapter (id, number, cover_type) VALUES (?, ?, ?)").use {
                it.setObject(1, unusedId)
                it.setInt(2, 0)
                it.setString(3, "STANDARD")
                it.executeUpdate()
            }
        }
        assertSqlFailure {
            connection.prepareStatement(
                "INSERT INTO chapter (id, number, volume_id, cover_type) VALUES (?, ?, ?, ?)",
            ).use {
                it.setObject(1, unusedId)
                it.setInt(2, 3)
                it.setObject(3, missingId)
                it.setString(4, "STANDARD")
                it.executeUpdate()
            }
        }
        assertSqlFailure {
            connection.prepareStatement("INSERT INTO chapter (id, number, cover_type) VALUES (?, ?, ?)").use {
                it.setObject(1, unusedId)
                it.setInt(2, 1)
                it.setString(3, "STANDARD")
                it.executeUpdate()
            }
        }
        assertSqlFailure {
            connection.prepareStatement("INSERT INTO chapter (id, number, cover_type) VALUES (?, ?, ?)").use {
                it.setObject(1, unusedId)
                it.setInt(2, 4)
                it.setString(3, "UNDOCUMENTED")
                it.executeUpdate()
            }
        }
        assertSqlFailure {
            connection.prepareStatement(
                "INSERT INTO chapter (id, number, page_count, cover_type) VALUES (?, ?, ?, ?)",
            ).use {
                it.setObject(1, unusedId)
                it.setInt(2, 5)
                it.setInt(3, 0)
                it.setString(4, "STANDARD")
                it.executeUpdate()
            }
        }
        assertSqlFailure {
            connection.prepareStatement(
                "INSERT INTO chapter_translation (chapter_id, locale, title) VALUES (?, ?, ?)",
            ).use {
                it.setObject(1, chapterId)
                it.setString(2, "en")
                it.setString(3, "Duplicate locale")
                it.executeUpdate()
            }
        }
        assertSqlFailure {
            connection.prepareStatement(
                "INSERT INTO chapter_translation (chapter_id, locale, title) VALUES (?, ?, ?)",
            ).use {
                it.setObject(1, missingId)
                it.setString(2, "en")
                it.setString(3, "Missing chapter")
                it.executeUpdate()
            }
        }
        assertSqlFailure {
            connection.prepareStatement("INSERT INTO source (id, type, volume_id) VALUES (?, ?, ?)").use {
                it.setObject(1, unusedId)
                it.setString(2, "SBS")
                it.setObject(3, missingId)
                it.executeUpdate()
            }
        }
        assertSqlFailure {
            connection.prepareStatement("INSERT INTO source (id, type, chapter_id) VALUES (?, ?, ?)").use {
                it.setObject(1, unusedId)
                it.setString(2, "MANGA_CHAPTER")
                it.setObject(3, missingId)
                it.executeUpdate()
            }
        }
        assertSqlFailure {
            connection.prepareStatement("INSERT INTO source (id, type) VALUES (?, ?)").use {
                it.setObject(1, unusedId)
                it.setString(2, "COMMUNITY_WIKI")
                it.executeUpdate()
            }
        }
    }

    private fun assertSqlFailure(block: () -> Unit) {
        assertFailsWith<SQLException>(block = block)
    }

    companion object {
        @Container
        @JvmStatic
        val postgres = PostgreSQLContainer("postgres:18-alpine")
    }
}
