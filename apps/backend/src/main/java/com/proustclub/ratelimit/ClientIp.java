package com.proustclub.ratelimit;

import jakarta.servlet.http.HttpServletRequest;

final class ClientIp {

    private ClientIp() {}

    // No reverse proxy sits in front of the app yet. Never read X-Forwarded-For here until
    // there is a specific, trusted proxy that strips/sets it — a client can set that header
    // itself and pick its own rate-limit bucket otherwise.
    static String resolve(HttpServletRequest request) {
        return request.getRemoteAddr();
    }
}
