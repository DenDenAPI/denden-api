plugins {
    kotlin("jvm") version "2.4.20" apply false
    kotlin("plugin.serialization") version "2.4.20" apply false
    id("dev.zacsweers.metro") version "1.4.5" apply false
    id("org.jooq.jooq-codegen-gradle") version "3.19.38" apply false
}

allprojects {
    group = "com.dendenapi"
    version = "0.1.0-SNAPSHOT"

    repositories {
        mavenCentral()
    }
}

subprojects {
    tasks.withType<Test>().configureEach {
        useJUnitPlatform()
    }
}
