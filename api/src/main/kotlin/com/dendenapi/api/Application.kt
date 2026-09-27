package com.dendenapi.api

import dev.zacsweers.metro.DependencyGraph
import dev.zacsweers.metro.Inject
import dev.zacsweers.metro.createGraph
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.engine.embeddedServer
import io.ktor.server.netty.Netty
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation

@DependencyGraph
interface ApplicationGraph {
    val apiServer: ApiServer
}

@Inject
class ApiServer {
    fun start() {
        val host = System.getenv("HOST") ?: "0.0.0.0"
        val port = System.getenv("PORT")?.toIntOrNull() ?: 8080

        embeddedServer(Netty, host = host, port = port, module = Application::module)
            .start(wait = true)
    }
}

fun main() = createGraph<ApplicationGraph>().apiServer.start()

fun Application.module() {
    install(ContentNegotiation) {
        json()
    }
}
