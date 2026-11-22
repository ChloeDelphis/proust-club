package com.proustclub.admin.provisioning;

import com.proustclub.admin.auth.AdminMfaService;
import com.proustclub.admin.AdminDataRepository;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminProvisioningServiceTest {

    @Test
    void provisionsVerifiedUserAndReturnsOneTimeMfaSetupAfterSuccessfulDatabaseWrites() {
        var repository = mock(AdminDataRepository.class);
        var mfa = mock(AdminMfaService.class);
        var service = new AdminProvisioningService(repository, mfa);
        var userId = UUID.randomUUID();
        when(repository.userToProvision("admin@example.com")).thenReturn(Optional.of(userId));
        when(mfa.generateSecret()).thenReturn("totp-secret");
        when(mfa.recoveryCode()).thenReturn("one-time-code");
        when(mfa.encrypt("totp-secret")).thenReturn(new byte[]{1, 2, 3});
        when(mfa.recoveryCodeHash("one-time-code")).thenReturn("hash");
        when(mfa.provisioningUri("admin@example.com", "totp-secret")).thenReturn("otpauth://setup");

        var setup = service.provision(" ADMIN@EXAMPLE.COM ");

        assertThat(setup.email()).isEqualTo("admin@example.com");
        assertThat(setup.provisioningUri()).isEqualTo("otpauth://setup");
        assertThat(setup.recoveryCodes()).hasSize(10).containsOnly("one-time-code");
        verify(repository).promoteAndProvision(eq(userId), eq(new byte[]{1, 2, 3}), eq(java.util.Collections.nCopies(10, "hash")));
    }

    @Test
    void refusesAnotherBootstrapWhenAnAdminAlreadyExists() {
        var repository = mock(AdminDataRepository.class);
        var service = new AdminProvisioningService(repository, mock(AdminMfaService.class));
        when(repository.hasAdmin()).thenReturn(true);

        assertThatThrownBy(() -> service.provision("admin@example.com"))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("first-admin-only");
        verify(repository, never()).userToProvision(any());
    }

    @Test
    void requiresVerifiedExistingAdminForMfaReset() {
        var repository = mock(AdminDataRepository.class);
        var service = new AdminProvisioningService(repository, mock(AdminMfaService.class));
        when(repository.adminToReset("admin@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.resetMfa("admin@example.com"))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("verified ADMIN");
        verify(repository, never()).replaceMfa(any(), any(), any());
    }
}
