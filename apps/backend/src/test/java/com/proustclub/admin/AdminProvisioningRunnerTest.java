package com.proustclub.admin;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(OutputCaptureExtension.class)
class AdminProvisioningRunnerTest {

    @Test
    void printsSetupDetailsOnlyAfterProvisioningReturns(CapturedOutput output) {
        var provisioning = mock(AdminProvisioningService.class);
        var setup = new AdminSetupDetails("admin@example.com", "otpauth://one-time", List.of("recovery-code"));
        when(provisioning.provision("admin@example.com")).thenReturn(setup);

        new AdminProvisioningRunner(provisioning, "admin@example.com").run();

        verify(provisioning).provision("admin@example.com");
        assertThat(output.getOut()).contains("admin@example.com", "otpauth://one-time", "recovery-code");
    }

    @Test
    void rejectsMissingBootstrapEmailBeforeCallingService() {
        var provisioning = mock(AdminProvisioningService.class);
        when(provisioning.provision("")).thenThrow(new IllegalStateException("Set ADMIN_BOOTSTRAP_EMAIL"));

        assertThatThrownBy(() -> new AdminProvisioningRunner(provisioning, "").run())
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("ADMIN_BOOTSTRAP_EMAIL");
    }
}
