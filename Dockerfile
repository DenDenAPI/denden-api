FROM gradle:9.8.0-jdk17 AS build
WORKDIR /workspace
COPY . .
RUN ./gradlew :api:installDist --no-daemon

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /workspace/api/build/install/api/ ./
EXPOSE 8080
ENTRYPOINT ["/app/bin/api"]
