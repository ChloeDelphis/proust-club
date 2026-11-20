package com.proustclub.admin;

import dev.samstevens.totp.code.DefaultCodeGenerator;
import org.junit.jupiter.api.Test;

import java.util.Base64;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AdminMfaServiceTest {

    private static final String KEY = Base64.getEncoder().encodeToString(new byte[32]);

    @Test
    void encryptsSecretAndAcceptsCurrentTotpOnlyOnce() throws Exception {
        var repository = mock(AdminDataRepository.class);
        var service = new AdminMfaService(repository, KEY);
        var userId = UUID.randomUUID();
        var secret = service.generateSecret();
        var cipherText = service.encrypt(secret);
        var code = new DefaultCodeGenerator().generate(secret, System.currentTimeMillis() / 30_000);
        when(repository.encryptedSecret(userId)).thenReturn(Optional.of(cipherText));
        when(repository.claimTotpCounter(org.mockito.ArgumentMatchers.eq(userId), org.mockito.ArgumentMatchers.anyLong()))
                .thenReturn(true, false);

        assertThat(cipherText).isNotEqualTo(secret.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        assertThat(service.verifyAndConsume(userId, code)).isTrue();
        assertThat(service.verifyAndConsume(userId, code)).isFalse();
    }

    @Test
    void acceptsRecoveryCodeOnceAndStoresOnlyItsHash() {
        var repository = mock(AdminDataRepository.class);
        var service = new AdminMfaService(repository, KEY);
        var userId = UUID.randomUUID();
        var recoveryCode = service.recoveryCode();
        when(repository.encryptedSecret(userId)).thenReturn(Optional.of(service.encrypt(service.generateSecret())));
        when(repository.consumeRecoveryCode(userId, service.recoveryCodeHash(recoveryCode))).thenReturn(true);

        assertThat(service.verifyAndConsume(userId, recoveryCode)).isTrue();
        assertThat(service.recoveryCodeHash(recoveryCode)).hasSize(64);
        assertThat(service.recoveryCodeHash(recoveryCode)).isNotEqualTo(recoveryCode);
    }

    @Test
    void failsClosedWhenEncryptionKeyIsInvalid() {
        var service = new AdminMfaService(mock(AdminDataRepository.class), "invalid");

        assertThatThrownBy(() -> service.encrypt(service.generateSecret()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("ADMIN_MFA_ENCRYPTION_KEY");
    }

    @Test
    void rejectsMissingSecretsMalformedCodesAndCorruptCiphertext() {
        var repository = mock(AdminDataRepository.class);
        var service = new AdminMfaService(repository, KEY);
        var userId = UUID.randomUUID();
        when(repository.encryptedSecret(userId)).thenReturn(Optional.empty(), Optional.of(new byte[]{1, 2}));

        assertThat(service.verifyAndConsume(userId, "123456")).isFalse();
        assertThat(service.verifyAndConsume(userId, "not-a-code")).isFalse();
    }

    @Test
    void buildsAuthenticatorUriWithIssuerAndEmail() {
        var service = new AdminMfaService(mock(AdminDataRepository.class), KEY);

        assertThat(service.provisioningUri("admin@example.com", "secret123"))
                .contains("Proust%20Club", "admin%40example.com", "secret=secret123", "period=30");
    }
}
