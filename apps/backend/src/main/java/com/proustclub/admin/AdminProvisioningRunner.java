package com.proustclub.admin;

import org.springframework.boot.CommandLineRunner;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile("admin-provision")
class AdminProvisioningRunner implements CommandLineRunner {

    private final AdminProvisioningService provisioningService;
    private final String bootstrapEmail;

    AdminProvisioningRunner(AdminProvisioningService provisioningService,
                            @Value("${ADMIN_BOOTSTRAP_EMAIL:}") String bootstrapEmail) {
        this.provisioningService = provisioningService;
        this.bootstrapEmail = bootstrapEmail;
    }

    @Override
    public void run(String... args) {
        AdminSetupDetails setup = provisioningService.provision(bootstrapEmail);
        System.out.println("Admin account provisioned for " + setup.email() + ". Configure an authenticator with this URI now:");
        System.out.println(setup.provisioningUri());
        System.out.println("Store these one-time recovery codes offline; they will not be shown again:");
        setup.recoveryCodes().forEach(System.out::println);
    }
}
