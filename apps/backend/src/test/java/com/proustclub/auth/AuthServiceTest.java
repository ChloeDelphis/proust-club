package com.proustclub.auth;

import com.proustclub.auth.dto.RegisterRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.ErrorResponseException;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    UserRepository repository;

    @Mock
    PasswordEncoder passwordEncoder;

    @Mock
    AuthenticationManager authenticationManager;

    @Mock
    EmailVerificationService emailVerificationService;

    @Mock
    PasswordBreachChecker passwordBreachChecker;

    @InjectMocks
    AuthService service;

    @Test
    void registerHashesPasswordBeforeInsertion() {
        var request = new RegisterRequest("marcel", "marcel@example.com", "hunter2222");
        var uuid = UUID.randomUUID();

        when(repository.existsByUsername("marcel")).thenReturn(false);
        when(repository.existsByEmail("marcel@example.com")).thenReturn(false);
        when(passwordEncoder.encode("hunter2222")).thenReturn("hashed-value");
        when(repository.insert("marcel", "marcel@example.com", "hashed-value")).thenReturn(uuid);

        var response = service.register(request);

        assertThat(response.uuid()).isEqualTo(uuid);
        assertThat(response.username()).isEqualTo("marcel");
        assertThat(response.email()).isEqualTo("marcel@example.com");
        assertThat(response.role()).isEqualTo("USER");
        assertThat(response.emailVerified()).isFalse();
        verify(repository).insert(eq("marcel"), eq("marcel@example.com"), eq("hashed-value"));
        verify(repository, never()).insert(any(), any(), eq("hunter2222"));
        verify(emailVerificationService).sendVerification(uuid, "marcel@example.com");
    }

    @Test
    void registerRejectsDuplicateUsername() {
        var request = new RegisterRequest("marcel", "marcel@example.com", "hunter2222");
        when(repository.existsByUsername("marcel")).thenReturn(true);

        assertThatThrownBy(() -> service.register(request))
                .isInstanceOf(ErrorResponseException.class)
                .isInstanceOf(ApiException.class);

        verify(repository, never()).insert(any(), any(), any());
    }

    @Test
    void registerRejectsDuplicateEmail() {
        var request = new RegisterRequest("marcel", "marcel@example.com", "hunter2222");
        when(repository.existsByUsername("marcel")).thenReturn(false);
        when(repository.existsByEmail("marcel@example.com")).thenReturn(true);

        assertThatThrownBy(() -> service.register(request))
                .isInstanceOf(ApiException.class);

        verify(repository, never()).insert(any(), any(), any());
    }

    @Test
    void checkNoCheapConflictsRejectsPasswordMatchingUsername() {
        var request = new RegisterRequest("marcel", "marcel@example.com", "marcel");

        assertThatThrownBy(() -> service.checkNoCheapConflicts(request))
                .isInstanceOf(ApiException.class);

        verify(repository, never()).existsByUsername(any());
    }

    @Test
    void checkNoCheapConflictsRejectsPasswordMatchingEmail() {
        var request = new RegisterRequest("marcel", "marcel@example.com", "marcel@example.com");

        assertThatThrownBy(() -> service.checkNoCheapConflicts(request))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void checkNoCheapConflictsRejectsDuplicateUsername() {
        var request = new RegisterRequest("marcel", "marcel@example.com", "hunter2222");
        when(repository.existsByUsername("marcel")).thenReturn(true);

        assertThatThrownBy(() -> service.checkNoCheapConflicts(request))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void checkNoCheapConflictsRejectsDuplicateEmail() {
        var request = new RegisterRequest("marcel", "marcel@example.com", "hunter2222");
        when(repository.existsByUsername("marcel")).thenReturn(false);
        when(repository.existsByEmail("marcel@example.com")).thenReturn(true);

        assertThatThrownBy(() -> service.checkNoCheapConflicts(request))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void checkNoCheapConflictsAllowsValidRequest() {
        var request = new RegisterRequest("marcel", "marcel@example.com", "hunter2222");
        when(repository.existsByUsername("marcel")).thenReturn(false);
        when(repository.existsByEmail("marcel@example.com")).thenReturn(false);

        service.checkNoCheapConflicts(request);
    }

    @Test
    void checkPasswordNotCompromisedRejectsCompromisedPassword() {
        when(passwordBreachChecker.isCompromised("hunter2222")).thenReturn(true);

        assertThatThrownBy(() -> service.checkPasswordNotCompromised("hunter2222"))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void checkPasswordNotCompromisedAllowsSafePassword() {
        when(passwordBreachChecker.isCompromised("hunter2222")).thenReturn(false);

        service.checkPasswordNotCompromised("hunter2222");
    }

    @Test
    void checkPasswordNotCompromisedFailsOpenWhenCheckerErrors() {
        when(passwordBreachChecker.isCompromised("hunter2222"))
                .thenThrow(new RuntimeException("HIBP unreachable"));

        service.checkPasswordNotCompromised("hunter2222");
    }

    @Test
    void reauthenticateNormalizesTheEmailBeforeDelegatingToAuthenticationManager() {
        var authentication = mock(Authentication.class);
        when(authenticationManager.authenticate(new UsernamePasswordAuthenticationToken("marcel@example.com", "hunter2222")))
                .thenReturn(authentication);

        var result = service.reauthenticate("  Marcel@Example.com  ", "hunter2222");

        assertThat(result).isSameAs(authentication);
    }

    @Test
    void reauthenticateNeverLooksUpTheRepositoryItself() {
        // The whole point of delegating straight to AuthenticationManager is that resolution
        // happens exclusively inside AuthUserDetailsService, reached through it — never as a
        // manual pre-check here, which would bypass DaoAuthenticationProvider's timing-attack
        // mitigation for an unknown email (see ADR-013). This guards against that regression
        // creeping back in, independently of the structural integration test on AuthController.
        when(authenticationManager.authenticate(any()))
                .thenThrow(new BadCredentialsException("Bad credentials"));

        assertThatThrownBy(() -> service.reauthenticate("marcel@example.com", "wrong-password"))
                .isInstanceOf(ApiException.class);

        verifyNoInteractions(repository);
    }

    @Test
    void currentUserResolvesByUuid() {
        var uuid = UUID.randomUUID();
        when(repository.findByUuid(uuid)).thenReturn(Optional.of(
                new AuthUser(uuid, "marcel", "marcel@example.com", "hash", "USER", true)));

        var response = service.currentUser(uuid);

        assertThat(response.uuid()).isEqualTo(uuid);
        assertThat(response.username()).isEqualTo("marcel");
    }
}
