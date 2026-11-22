package com.proustclub.config;

import org.springframework.boot.jooq.autoconfigure.DefaultConfigurationCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class JooqConfig {

    @Bean
    DefaultConfigurationCustomizer renderDatabaseSchemas() {
        return configuration -> configuration.settings().setRenderSchema(true);
    }
}
