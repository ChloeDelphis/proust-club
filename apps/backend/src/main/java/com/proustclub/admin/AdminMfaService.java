package com.proustclub.admin;

import dev.samstevens.totp.code.DefaultCodeGenerator;
import dev.samstevens.totp.exceptions.CodeGenerationException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.UUID;

@Service
class AdminMfaService {

    private static final SecureRandom RANDOM = new SecureRandom();
    private final AdminDataRepository repository;
    private final String configuredKey;

    AdminMfaService(AdminDataRepository repository, @Value("${app.admin.mfa-encryption-key:}") String configuredKey) {
        this.repository = repository;
        this.configuredKey = configuredKey;
    }

    String generateSecret() {
        return new dev.samstevens.totp.secret.DefaultSecretGenerator().generate();
    }

    byte[] encrypt(String secret) {
        var key = encryptionKey();
        try {
            byte[] nonce = new byte[12];
            RANDOM.nextBytes(nonce);
            var cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(128, nonce));
            byte[] encrypted = cipher.doFinal(secret.getBytes(StandardCharsets.UTF_8));
            return ByteBuffer.allocate(nonce.length + encrypted.length).put(nonce).put(encrypted).array();
        } catch (Exception e) {
            throw new IllegalStateException("Could not encrypt admin MFA secret", e);
        }
    }

    @Transactional
    boolean verifyAndConsume(UUID userId, String submittedCode) {
        var encrypted = repository.encryptedSecret(userId);
        if (encrypted.isEmpty()) return false;
        String secret;
        try {
            secret = decrypt(encrypted.get());
        } catch (RuntimeException e) {
            return false;
        }

        String code = submittedCode == null ? "" : submittedCode.trim().replace(" ", "");
        if (code.matches("[0-9]{6}")) {
            var matchingCounter = matchingTotpCounter(secret, code);
            return matchingCounter.isPresent() && repository.claimTotpCounter(userId, matchingCounter.getAsLong());
        }

        String normalized = normalizeRecoveryCode(code);
        return normalized.matches("[A-Z0-9_-]{16,32}")
                && repository.consumeRecoveryCode(userId, sha256(normalized));
    }

    private java.util.OptionalLong matchingTotpCounter(String secret, String code) {
        long currentCounter = System.currentTimeMillis() / 30_000;
        var generator = new DefaultCodeGenerator();
        for (long candidate : new long[]{currentCounter, currentCounter - 1, currentCounter + 1}) {
            try {
                String expected = generator.generate(secret, candidate);
                if (MessageDigest.isEqual(expected.getBytes(StandardCharsets.US_ASCII),
                        code.getBytes(StandardCharsets.US_ASCII))) {
                    return java.util.OptionalLong.of(candidate);
                }
            } catch (CodeGenerationException e) {
                return java.util.OptionalLong.empty();
            }
        }
        return java.util.OptionalLong.empty();
    }

    String recoveryCode() {
        byte[] bytes = new byte[12];
        RANDOM.nextBytes(bytes);
        return java.util.HexFormat.of().formatHex(bytes);
    }

    String recoveryCodeHash(String code) {
        return sha256(normalizeRecoveryCode(code));
    }

    private static String normalizeRecoveryCode(String code) {
        return code.replace("-", "").replace(" ", "").toUpperCase(java.util.Locale.ROOT);
    }

    String provisioningUri(String email, String secret) {
        return "otpauth://totp/Proust%20Club:" + java.net.URLEncoder.encode(email, StandardCharsets.UTF_8)
                + "?secret=" + secret + "&issuer=Proust%20Club&algorithm=SHA1&digits=6&period=30";
    }

    private String decrypt(byte[] encrypted) {
        try {
            ByteBuffer buffer = ByteBuffer.wrap(encrypted);
            byte[] nonce = new byte[12];
            buffer.get(nonce);
            byte[] ciphertext = new byte[buffer.remaining()];
            buffer.get(ciphertext);
            var cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, encryptionKey(), new GCMParameterSpec(128, nonce));
            return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalStateException("Could not decrypt admin MFA secret", e);
        }
    }

    private SecretKeySpec encryptionKey() {
        try {
            byte[] key = Base64.getDecoder().decode(configuredKey);
            if (key.length != 32) throw new IllegalArgumentException("expected 32 bytes");
            return new SecretKeySpec(key, "AES");
        } catch (RuntimeException e) {
            throw new IllegalStateException("ADMIN_MFA_ENCRYPTION_KEY must be a base64-encoded 32-byte key", e);
        }
    }

    private static String sha256(String value) {
        try {
            return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 is not available", e);
        }
    }
}
