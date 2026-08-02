package com.proustclub.auth;

import com.proustclub.auth.dto.RegisterRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.ErrorResponseException;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    UserRepository repository;

    @Mock
    PasswordEncoder passwordEncoder;

    @Mock
    AuthenticationManager authenticationManager;

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
        verify(repository).insert(eq("marcel"), eq("marcel@example.com"), eq("hashed-value"));
        verify(repository, never()).insert(any(), any(), eq("hunter2222"));
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
}
