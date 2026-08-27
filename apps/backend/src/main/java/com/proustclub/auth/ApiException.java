package com.proustclub.auth;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;

class ApiException extends ErrorResponseException {

    private ApiException(HttpStatus status, String detail) {
        super(status, ProblemDetail.forStatusAndDetail(status, detail), null);
    }

    static ApiException usernameAlreadyExists() {
        return new ApiException(HttpStatus.CONFLICT, "Username already exists.");
    }

    static ApiException emailAlreadyExists() {
        return new ApiException(HttpStatus.CONFLICT, "Email already exists.");
    }

    static ApiException passwordMatchesIdentifier() {
        return new ApiException(HttpStatus.BAD_REQUEST, "Password must not match the username or email.");
    }

    static ApiException invalidCredentials() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "Invalid email or password.");
    }

    // Deliberately generic — never distinguishes "expired" from "already used" from "never
    // existed", so the endpoint can't be used to probe the state of a specific link.
    static ApiException invalidOrExpiredResetToken() {
        return new ApiException(HttpStatus.BAD_REQUEST, "Invalid or expired reset token.");
    }

    // Same anti-enumeration reasoning as invalidOrExpiredResetToken().
    static ApiException invalidOrExpiredVerificationToken() {
        return new ApiException(HttpStatus.BAD_REQUEST, "Invalid or expired verification token.");
    }

    static ApiException emailAlreadyVerified() {
        return new ApiException(HttpStatus.CONFLICT, "Email already verified.");
    }

    // 422, not 400: the frontend deliberately excludes 400 from any specific error mapping (several
    // distinct causes share that status, and the client never reads this detail — only the status,
    // see RegisterPage.tsx), so this needed its own status to surface a precise, actionable message
    // instead of falling into the generic "something went wrong" fallback.
    static ApiException passwordCompromised() {
        return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "Password found in a known data breach.");
    }
}
