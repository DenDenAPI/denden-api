package com.dendenapi.infrastructure.codegen;

import java.sql.Connection;
import java.sql.SQLException;
import org.flywaydb.core.Flyway;

public final class JooqMigrationInitializer {
    private JooqMigrationInitializer() {}

    public static void migrate(Connection connection) throws SQLException {
        Flyway.configure()
                .dataSource(connection.getMetaData().getURL(), "test", "test")
                .locations("classpath:db/migration")
                .load()
                .migrate();
    }
}
