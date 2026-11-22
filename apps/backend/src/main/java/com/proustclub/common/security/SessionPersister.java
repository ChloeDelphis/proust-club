package com.proustclub.common.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.stereotype.Component;

// Shared by every controller that authenticates programmatically instead of going through
// Spring Security's filter-based login flow (see ADR-002) — each needs the exact same manual
// replay of what that flow normally does for free (session id rotation, CSRF rotation, session
// registration; see SecurityConfig.sessionAuthenticationStrategy()).
@Component
public class SessionPersister {

    private final SessionAuthenticationStrategy sessionAuthenticationStrategy;
    private final SecurityContextRepository securityContextRepository;

    public SessionPersister(SessionAuthenticationStrategy sessionAuthenticationStrategy, SecurityContextRepository securityContextRepository) {
        this.sessionAuthenticationStrategy = sessionAuthenticationStrategy;
        this.securityContextRepository = securityContextRepository;
    }

    public void persist(Authentication authentication, HttpServletRequest request, HttpServletResponse response) {
        sessionAuthenticationStrategy.onAuthentication(authentication, request, response);
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        securityContextRepository.saveContext(context, request, response);
    }
}
