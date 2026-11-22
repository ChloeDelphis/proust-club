package com.proustclub.admin.provisioning;

import com.proustclub.admin.provisioning.AdminProvisioningService;
import org.springframework.boot.CommandLineRunner;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile("admin-mfa-reset")
public class AdminMfaResetRunner implements CommandLineRunner {

    private final AdminProvisioningService provisioningService;
    private final String bootstrapEmail;
    private final String resetConfirmation;

    public AdminMfaResetRunner(AdminProvisioningService provisioningService,
                        @Value("${ADMIN_BOOTSTRAP_EMAIL:}") String bootstrapEmail,
                        @Value("${ADMIN_CONFIRM_MFA_RESET:}") String resetConfirmation) {
        this.provisioningService = provisioningService;
        this.bootstrapEmail = bootstrapEmail;
        this.resetConfirmation = resetConfirmation;
    }

    @Override
    public void run(String... args) {
        if (!"RESET".equals(resetConfirmation)) {
            throw new IllegalStateException("Set ADMIN_CONFIRM_MFA_RESET=RESET to confirm this privileged operation.");
        }
        AdminSetupDetails setup = provisioningService.resetMfa(bootstrapEmail);
        System.out.println("Admin MFA reset for " + setup.email() + ". Configure this URI now:");
        System.out.println(setup.provisioningUri());
        System.out.println("Store these new one-time recovery codes offline:");
        setup.recoveryCodes().forEach(System.out::println);
    }
}
