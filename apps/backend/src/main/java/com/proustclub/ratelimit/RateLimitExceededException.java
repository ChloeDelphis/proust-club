package com.proustclub.ratelimit;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;

import java.time.Duration;

class RateLimitExceededException extends ErrorResponseException {

    private final long retryAfterSeconds;

    RateLimitExceededException(Duration retryAfter) {
        super(HttpStatus.TOO_MANY_REQUESTS,
                ProblemDetail.forStatusAndDetail(HttpStatus.TOO_MANY_REQUESTS, "Too many requests. Please try again later."),
                null);
        // Round up: telling the client "0 seconds" when a few hundred ms remain just invites
        // an immediate retry that gets rate-limited again.
        this.retryAfterSeconds = (retryAfter.toNanos() + 999_999_999) / 1_000_000_000;
    }

    @Override
    public HttpHeaders getHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.add(HttpHeaders.RETRY_AFTER, String.valueOf(retryAfterSeconds));
        return headers;
    }
}
