FROM docker.io/maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /build

COPY pom.xml ./
COPY src ./src

RUN mvn -q -DskipTests package

FROM docker.io/eclipse-temurin:17-jre
WORKDIR /app

COPY --from=build /build/target/fts-indexer-0.0.1-SNAPSHOT.jar /app/fts-indexer.jar

ENTRYPOINT ["java", "-jar", "/app/fts-indexer.jar"]