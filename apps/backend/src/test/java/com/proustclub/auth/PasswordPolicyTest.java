package com.proustclub.auth;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PasswordPolicyTest {

    @Test
    void rejectsUsernameIgnoringCaseAndSurroundingSpaces() {
        assertThatThrownBy(() -> PasswordPolicy.requireDistinctFromIdentifiers(
                "A Very Long User Name", " a very long user name ", "marcel@example.com"
        ))
                .isInstanceOf(ApiException.class)
                .satisfies(error -> assertThat(((ApiException) error).getBody().getProperties())
                        .containsEntry("code", "password_matches_identifier"));
    }

    @Test
    void rejectsNormalizedEmailIgnoringCase() {
        assertThatThrownBy(() -> PasswordPolicy.requireDistinctFromIdentifiers(
                "MARCEL@EXAMPLE.COM", "marcel", " Marcel@Example.com "
        )).isInstanceOf(ApiException.class);
    }

    @Test
    void allowsPassphraseContainingIdentifier() {
        assertThatCode(() -> PasswordPolicy.requireDistinctFromIdentifiers(
                "A passphrase containing marcel@example.com is allowed", "marcel", "marcel@example.com"
        )).doesNotThrowAnyException();
    }

    @Test
    void allowsPasswordDistinctFromIdentifiers() {
        assertThatCode(() -> PasswordPolicy.requireDistinctFromIdentifiers(
                "Les madeleines de Combray", "marcel", "marcel@example.com"
        )).doesNotThrowAnyException();
    }
}
