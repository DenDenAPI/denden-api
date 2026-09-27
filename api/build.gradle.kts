plugins {
    kotlin("jvm")
    kotlin("plugin.serialization")
    id("dev.zacsweers.metro")
    application
}

kotlin {
    jvmToolchain(21)
}

application {
    mainClass.set("com.dendenapi.api.ApplicationKt")
}

dependencies {
    implementation(project(":application"))
    implementation(project(":infrastructure"))

    implementation(platform("io.ktor:ktor-bom:3.6.0"))
    implementation("io.ktor:ktor-server-core")
    implementation("io.ktor:ktor-server-netty")
    implementation("io.ktor:ktor-server-content-negotiation")
    implementation("io.ktor:ktor-serialization-kotlinx-json")

    runtimeOnly("ch.qos.logback:logback-classic:1.5.18")

    testImplementation(kotlin("test"))
    testImplementation("org.junit.jupiter:junit-jupiter:5.13.4")
    testImplementation("io.ktor:ktor-server-test-host")
}
