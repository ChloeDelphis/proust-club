package com.proustclub.codegen;

import org.flywaydb.core.Flyway;

import java.net.URI;
import java.util.Set;

/** Applies the project's Flyway migrations before jOOQ inspects the PostgreSQL schema. */
public final class MigrateSchemaForCodegen {

    private static final Set<String> LOCAL_DATABASE_HOSTS = Set.of("localhost", "127.0.0.1", "::1");

    private MigrateSchemaForCodegen() {}

    public static void main(String[] args) {
        String url = environmentOrDefault("JOOQ_DB_URL", "jdbc:postgresql://localhost:5432/proustclub");
        String username = environmentOrDefault("JOOQ_DB_USERNAME", "proustclub");
        String password = environmentOrDefault("JOOQ_DB_PASSWORD", "proustclub_dev");

        requireLocalDatabase(url);

        Flyway.configure()
                .dataSource(url, username, password)
                .locations("filesystem:src/main/resources/db/migration")
                .load()
                .migrate();
    }

    private static void requireLocalDatabase(String jdbcUrl) {
        String url = jdbcUrl.startsWith("jdbc:") ? jdbcUrl.substring("jdbc:".length()) : jdbcUrl;
        String host = URI.create(url).getHost();
        if (host == null || !LOCAL_DATABASE_HOSTS.contains(host)) {
            throw new IllegalArgumentException("jOOQ code generation may only migrate a local PostgreSQL database");
        }
    }

    private static String environmentOrDefault(String name, String defaultValue) {
        String value = System.getenv(name);
        return value == null || value.isBlank() ? defaultValue : value;
    }
}
