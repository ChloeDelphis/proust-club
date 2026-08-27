package com.proustclub.auth;

import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class ProustClubPrincipalTest {

    private static final UUID USER_ID = UUID.randomUUID();

    @Test
    void getUsernameReturnsTheEmailCredentialNotThePublicUsername() {
        var principal = new ProustClubPrincipal(USER_ID, "marcel", "marcel@example.com", "hash", "USER");

        assertThat(principal.getUsername()).isEqualTo("marcel@example.com");
        assertThat(principal.getDisplayUsername()).isEqualTo("marcel");
        assertThat(principal.getUserId()).isEqualTo(USER_ID);
    }

    @Test
    void equalsAndHashCodeAreBasedOnUserIdOnly() {
        var first = new ProustClubPrincipal(USER_ID, "marcel", "marcel@example.com", "hash", "USER");
        var second = new ProustClubPrincipal(USER_ID, "different-username", "different@example.com", "different-hash", "ADMIN");

        assertThat(first).isEqualTo(second);
        assertThat(first.hashCode()).isEqualTo(second.hashCode());
    }

    @Test
    void differentUserIdsAreNeverEqual() {
        var first = new ProustClubPrincipal(USER_ID, "marcel", "marcel@example.com", "hash", "USER");
        var second = new ProustClubPrincipal(UUID.randomUUID(), "marcel", "marcel@example.com", "hash", "USER");

        assertThat(first).isNotEqualTo(second);
    }

    @Test
    void eraseCredentialsClearsThePasswordHash() {
        var principal = new ProustClubPrincipal(USER_ID, "marcel", "marcel@example.com", "hash", "USER");

        principal.eraseCredentials();

        assertThat(principal.getPassword()).isNull();
    }

    @Test
    void toStringNeverExposesEmailOrPasswordHash() {
        var principal = new ProustClubPrincipal(USER_ID, "marcel", "marcel@example.com", "super-secret-hash", "USER");

        assertThat(principal.toString())
                .doesNotContain("marcel@example.com")
                .doesNotContain("super-secret-hash")
                .contains(USER_ID.toString())
                .contains("marcel");
    }

    @Test
    void getAuthoritiesPrefixesTheRole() {
        var principal = new ProustClubPrincipal(USER_ID, "marcel", "marcel@example.com", "hash", "ADMIN");

        assertThat(principal.getAuthorities())
                .extracting(Object::toString)
                .containsExactly("ROLE_ADMIN");
    }
}
