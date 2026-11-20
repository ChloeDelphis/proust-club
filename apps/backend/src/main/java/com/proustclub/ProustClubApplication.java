package com.proustclub;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.util.Arrays;

@SpringBootApplication
@ConfigurationPropertiesScan
@EnableScheduling
public class ProustClubApplication {

    private static final Logger log = LoggerFactory.getLogger(ProustClubApplication.class);

    public static void main(String[] args) {
        var mode = modeFor(args);
        var application = new SpringApplicationBuilder(ProustClubApplication.class).web(mode.webType());
        if (mode.profile() != null) application.profiles(mode.profile());
        application.run(args);
    }

    static ApplicationMode modeFor(String... args) {
        if (Arrays.asList(args).contains("import-proust")) {
            return new ApplicationMode(org.springframework.boot.WebApplicationType.NONE, "import");
        }
        if (Arrays.asList(args).contains("provision-admin")) {
            return new ApplicationMode(org.springframework.boot.WebApplicationType.NONE, "admin-provision");
        }
        if (Arrays.asList(args).contains("reset-admin-mfa")) {
            return new ApplicationMode(org.springframework.boot.WebApplicationType.NONE, "admin-mfa-reset");
        }
        return new ApplicationMode(org.springframework.boot.WebApplicationType.SERVLET, null);
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onReady() {
        log.info("\uD83D\uDE80 Proust Club is ready.");
    }

    record ApplicationMode(org.springframework.boot.WebApplicationType webType, String profile) {}
}
