package com.proustclub;

import org.springframework.boot.SpringApplication;

public class TestProustClubApplication {

    public static void main(String[] args) {
        SpringApplication.from(ProustClubApplication::main)
                .with(TestcontainersConfiguration.class)
                .run(args);
    }
}
