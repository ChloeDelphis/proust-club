package com.proustclub.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.session.SessionInformationExpiredEvent;
import org.springframework.security.web.session.SessionInformationExpiredStrategy;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.net.URI;

// Spring Security's filter chain sits in front of Spring MVC, so exceptions/events it raises
// (unauthenticated access, CSRF rejection, a session found expired by ConcurrentSessionFilter —
// see ADR-010) never reach DispatcherServlet's exception resolvers — the default handlers write
// either a bare status or, for the session case, a 200 with a plain-text body. This class makes
// all three produce the same ProblemDetail contract as the rest of the API.
@Component
class ProblemDetailSecurityHandlers implements AuthenticationEntryPoint, AccessDeniedHandler, SessionInformationExpiredStrategy {

    private final ObjectMapper objectMapper;

    ProblemDetailSecurityHandlers(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response, AuthenticationException authException)
            throws IOException {
        write(request, response, HttpStatus.UNAUTHORIZED, "Full authentication is required to access this resource.");
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response, AccessDeniedException accessDeniedException)
            throws IOException {
        write(request, response, HttpStatus.FORBIDDEN, "Access to this resource is denied.");
    }

    // ConcurrentSessionFilter already invalidates the session (SecurityContextLogoutHandler)
    // before calling this — this only controls what that request's response looks like.
    @Override
    public void onExpiredSessionDetected(SessionInformationExpiredEvent event) throws IOException {
        write(event.getRequest(), event.getResponse(), HttpStatus.UNAUTHORIZED, "Session has expired.");
    }

    private void write(HttpServletRequest request, HttpServletResponse response, HttpStatus status, String detail)
            throws IOException {
        ProblemDetail problemDetail = ProblemDetail.forStatusAndDetail(status, detail);
        problemDetail.setInstance(URI.create(request.getRequestURI()));
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        objectMapper.writeValue(response.getWriter(), problemDetail);
    }
}
