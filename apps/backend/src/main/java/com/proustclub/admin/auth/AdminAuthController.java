package com.proustclub.admin.auth;

import com.proustclub.common.security.CurrentUser;
import com.proustclub.common.security.SessionPersister;
import com.proustclub.common.dto.UserResponse;
import com.proustclub.ratelimit.RateLimiter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@RestController
public class AdminAuthController {

    private static final Logger log = LoggerFactory.getLogger(AdminAuthController.class);

    private final AuthenticationManager authenticationManager;
    private final AdminMfaService mfaService;
    private final CurrentUser currentUser;
    private final SessionPersister sessionPersister;
    private final org.jooq.DSLContext dsl;
    private final RateLimiter rateLimiter;

    public AdminAuthController(AuthenticationManager authenticationManager, AdminMfaService mfaService,
                        CurrentUser currentUser, SessionPersister sessionPersister, org.jooq.DSLContext dsl,
                        RateLimiter rateLimiter) {
        this.authenticationManager = authenticationManager;
        this.mfaService = mfaService;
        this.currentUser = currentUser;
        this.sessionPersister = sessionPersister;
        this.dsl = dsl;
        this.rateLimiter = rateLimiter;
    }

    @PostMapping(value = "/api/admin/auth/login", produces = MediaType.APPLICATION_JSON_VALUE)
    public UserResponse login(@Valid @RequestBody AdminLoginRequest request, HttpServletRequest httpRequest,
                       HttpServletResponse httpResponse) {
        Authentication authentication;
        try {
            rateLimiter.checkLoginByIp(httpRequest);
            rateLimiter.checkLoginByAccount(request.email());
            authentication = authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(
                    request.email().trim().toLowerCase(java.util.Locale.ROOT), request.password()));
        } catch (AuthenticationException e) {
            log.warn("admin_login outcome=failure reason=invalid_credentials");
            throw invalidCredentials();
        }
        if (!authentication.getAuthorities().contains(new SimpleGrantedAuthority("ROLE_ADMIN"))) {
            log.warn("admin_login outcome=failure reason=invalid_credentials");
            throw invalidCredentials();
        }
        var userId = currentUser.resolveUuid(authentication);
        if (!mfaService.verifyAndConsume(userId, request.code())) {
            log.warn("admin_login outcome=failure reason=invalid_credentials");
            throw invalidCredentials();
        }
        sessionPersister.persist(authentication, httpRequest, httpResponse);
        log.info("admin_login outcome=success");
        return dsl.select(com.proustclub.jooq.identity.Tables.USERS.UUID, com.proustclub.jooq.identity.Tables.USERS.USERNAME,
                        com.proustclub.jooq.identity.Tables.USERS.EMAIL, com.proustclub.jooq.identity.Tables.USERS.ROLE,
                        com.proustclub.jooq.identity.Tables.USERS.EMAIL_VERIFIED)
                .from(com.proustclub.jooq.identity.Tables.USERS)
                .where(com.proustclub.jooq.identity.Tables.USERS.UUID.eq(userId))
                .fetchOne(r -> new UserResponse(r.value1(), r.value2(), r.value3(), r.value4(), r.value5()));
    }

    private static ResponseStatusException invalidCredentials() {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid admin credentials or second factor.");
    }

    record AdminLoginRequest(@NotBlank @Email @Size(max = 255) String email,
                             @NotBlank String password, @NotBlank @Size(max = 64) String code) {}
}
