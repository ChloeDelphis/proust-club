package com.proustclub.admin.provisioning;

import com.proustclub.admin.auth.AdminMfaService;
import com.proustclub.admin.AdminDataRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
public class AdminProvisioningService {

    private final AdminDataRepository repository;
    private final AdminMfaService mfaService;

    public AdminProvisioningService(AdminDataRepository repository, AdminMfaService mfaService) {
        this.repository = repository;
        this.mfaService = mfaService;
    }

    @Transactional
    public AdminSetupDetails provision(String email) {
        if (email == null || email.isBlank()) throw new IllegalStateException("Set ADMIN_BOOTSTRAP_EMAIL to a verified USER account.");
        String normalizedEmail = email.trim().toLowerCase(java.util.Locale.ROOT);
        if (repository.hasAdmin()) throw new IllegalStateException("An ADMIN already exists; bootstrap is first-admin-only.");
        var userId = repository.userToProvision(normalizedEmail)
                .orElseThrow(() -> new IllegalStateException("No verified USER account matches ADMIN_BOOTSTRAP_EMAIL."));
        String secret = mfaService.generateSecret();
        var recoveryCodes = new ArrayList<String>();
        for (int index = 0; index < 10; index++) recoveryCodes.add(mfaService.recoveryCode());
        repository.promoteAndProvision(userId, mfaService.encrypt(secret),
                recoveryCodes.stream().map(mfaService::recoveryCodeHash).toList());
        return new AdminSetupDetails(normalizedEmail, mfaService.provisioningUri(normalizedEmail, secret), recoveryCodes);
    }

    @Transactional
    public AdminSetupDetails resetMfa(String email) {
        if (email == null || email.isBlank()) throw new IllegalStateException("Set ADMIN_BOOTSTRAP_EMAIL to the existing admin account.");
        String normalizedEmail = email.trim().toLowerCase(java.util.Locale.ROOT);
        var userId = repository.adminToReset(normalizedEmail)
                .orElseThrow(() -> new IllegalStateException("No verified ADMIN account matches ADMIN_BOOTSTRAP_EMAIL."));
        String secret = mfaService.generateSecret();
        var recoveryCodes = new ArrayList<String>();
        for (int index = 0; index < 10; index++) recoveryCodes.add(mfaService.recoveryCode());
        repository.replaceMfa(userId, mfaService.encrypt(secret),
                recoveryCodes.stream().map(mfaService::recoveryCodeHash).toList());
        return new AdminSetupDetails(normalizedEmail, mfaService.provisioningUri(normalizedEmail, secret), recoveryCodes);
    }
}
