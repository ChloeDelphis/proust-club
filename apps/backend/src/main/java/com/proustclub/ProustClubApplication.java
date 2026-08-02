package com.proustclub;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.context.event.EventListener;

import java.util.Arrays;

@SpringBootApplication
@ConfigurationPropertiesScan
public class ProustClubApplication {

    private static final Logger log = LoggerFactory.getLogger(ProustClubApplication.class);

    public static void main(String[] args) {
        if (Arrays.asList(args).contains("import-proust")) {
            new SpringApplicationBuilder(ProustClubApplication.class)
                    .web(org.springframework.boot.WebApplicationType.NONE)
                    .profiles("import")
                    .run(args);
        } else {
            SpringApplication.run(ProustClubApplication.class, args);
        }
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onReady() {
        log.info("\uD83D\uDE80 Proust Club is ready.");
    }
}
