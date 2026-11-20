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
class AdminMfaResetRunnerTest {

    @Test
    void resetRequiresExplicitConfirmation() {
        var provisioning = mock(AdminProvisioningService.class);

        assertThatThrownBy(() -> new AdminMfaResetRunner(provisioning, "admin@example.com", "").run())
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("ADMIN_CONFIRM_MFA_RESET");
    }

    @Test
    void printsReplacementSetupOnlyAfterResetSucceeds(CapturedOutput output) {
        var provisioning = mock(AdminProvisioningService.class);
        var setup = new AdminSetupDetails("admin@example.com", "otpauth://replacement", List.of("new-recovery"));
        when(provisioning.resetMfa("admin@example.com")).thenReturn(setup);

        new AdminMfaResetRunner(provisioning, "admin@example.com", "RESET").run();

        verify(provisioning).resetMfa("admin@example.com");
        assertThat(output.getOut()).contains("MFA reset", "otpauth://replacement", "new-recovery");
    }
}
