package com.proustclub.config;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.web.csrf.CsrfToken;

import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

// Regression guard for a real bug found 2026-08-06 (see private/impl/csrf-rotation-bug-1-analyse.md):
// resolving the deferred CSRF token only before filterChain.doFilter() meant a token rotated
// mid-request by CsrfAuthenticationStrategy (login/register auto-authenticating, see
// SecurityConfig) never got its cookie written — the client was left with a deleted CSRF cookie
// and no valid replacement. A full MockMvc round-trip test for this proved as order-dependent
// under MockMvc as the rotation test the 2026-08-02 security audit had already tried and dropped
// for the same reason (see AuthControllerTest) — so this exercises the fixed filter directly, with
// no Spring context, deterministically.
@ExtendWith(MockitoExtension.class)
class CsrfCookieFilterTest {

    @Mock
    FilterChain chain;

    private final CsrfCookieFilter filter = new CsrfCookieFilter();

    @Test
    void resolvesTheTokenAttributePresentAfterTheChainRuns_notJustTheOneFromBefore() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        CsrfToken beforeChain = mock(CsrfToken.class);
        CsrfToken rotatedDuringChain = mock(CsrfToken.class);
        request.setAttribute(CsrfToken.class.getName(), beforeChain);

        // Simulates CsrfAuthenticationStrategy replacing the request attribute with a fresh,
        // unresolved token from inside the controller — i.e. during chain.doFilter().
        doAnswer(invocation -> {
            request.setAttribute(CsrfToken.class.getName(), rotatedDuringChain);
            return null;
        }).when(chain).doFilter(request, response);

        filter.doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
        verify(beforeChain).getToken();
        verify(rotatedDuringChain).getToken();
    }

    @Test
    void doesNothingWhenNoCsrfTokenAttributeIsPresent() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
    }
}
