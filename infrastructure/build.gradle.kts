plugins {
    kotlin("jvm")
    id("org.jooq.jooq-codegen-gradle")
}

kotlin {
    jvmToolchain(21)
}

val jooqMigration = sourceSets.create("jooqMigration") {
    java.srcDir("src/jooqMigration/java")
    resources.srcDir("src/main/resources")
}

val generatedJooqDirectory = layout.buildDirectory.dir("generated-src/jooq/main")

sourceSets.main {
    java.srcDir(generatedJooqDirectory)
}

dependencies {
    implementation(project(":domain"))
    implementation(project(":application"))

    implementation("org.jooq:jooq:3.19.38")
    implementation("org.flywaydb:flyway-core:11.13.2")
    implementation("org.flywaydb:flyway-database-postgresql:11.13.2")
    implementation("com.zaxxer:HikariCP:6.3.1")
    runtimeOnly("org.postgresql:postgresql:42.7.8")

    add(jooqMigration.implementationConfigurationName, "org.flywaydb:flyway-core:11.13.2")
    add(jooqMigration.implementationConfigurationName, "org.flywaydb:flyway-database-postgresql:11.13.2")

    jooqCodegen(jooqMigration.output)
    jooqCodegen("org.flywaydb:flyway-core:11.13.2")
    jooqCodegen("org.flywaydb:flyway-database-postgresql:11.13.2")
    jooqCodegen("org.postgresql:postgresql:42.7.8")
    jooqCodegen("org.testcontainers:testcontainers-jdbc:2.0.5")
    jooqCodegen("org.testcontainers:testcontainers-postgresql:2.0.5")

    testImplementation(kotlin("test"))
    testImplementation("org.junit.jupiter:junit-jupiter:5.13.4")
    testImplementation("org.testcontainers:testcontainers-junit-jupiter:2.0.5")
    testImplementation("org.testcontainers:testcontainers-postgresql:2.0.5")
}

jooq {
    configuration {
        jdbc {
            driver = "org.testcontainers.jdbc.ContainerDatabaseDriver"
            url =
                "jdbc:tc:postgresql:18-alpine:///dendenapi" +
                "?TC_INITFUNCTION=com.dendenapi.infrastructure.codegen.JooqMigrationInitializer::migrate"
            user = "test"
            password = "test"
        }
        generator {
            database {
                name = "org.jooq.meta.postgres.PostgresDatabase"
                inputSchema = "public"
                excludes = "flyway_schema_history"
            }
            generate {
                isDeprecated = false
                isRecords = true
                isPojos = false
                isDaos = false
            }
            target {
                packageName = "com.dendenapi.infrastructure.jooq"
                directory = generatedJooqDirectory.get().asFile.path
                isClean = true
            }
        }
    }
}

tasks.named("jooqCodegen") {
    dependsOn(tasks.named(jooqMigration.classesTaskName))
    inputs.files(fileTree("src/main/resources/db/migration"))
    outputs.dir(generatedJooqDirectory)
}

tasks.named("compileJava") {
    dependsOn(tasks.named("jooqCodegen"))
}

tasks.named("compileKotlin") {
    dependsOn(tasks.named("jooqCodegen"))
}
