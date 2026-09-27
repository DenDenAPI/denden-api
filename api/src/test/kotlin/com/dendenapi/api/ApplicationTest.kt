package com.dendenapi.api

import io.ktor.client.request.get
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.testApplication
import kotlin.test.Test
import kotlin.test.assertEquals

class ApplicationTest {
    @Test
    fun `application starts without exposing an unspecified route`() = testApplication {
        application { module() }

        assertEquals(HttpStatusCode.NotFound, client.get("/").status)
    }
}
