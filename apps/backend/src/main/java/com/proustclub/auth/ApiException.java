package com.proustclub.auth;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;

public class ApiException extends ErrorResponseException {

    private ApiException(HttpStatus status, String detail) {
        this(status, detail, null);
    }

    private ApiException(HttpStatus status, String detail, String code) {
        super(status, problemDetail(status, detail, code), null);
    }

    private static ProblemDetail problemDetail(HttpStatus status, String detail, String code) {
        var problem = ProblemDetail.forStatusAndDetail(status, detail);
        if (code != null) {
            problem.setProperty("code", code);
        }
        return problem;
    }

    public static ApiException usernameAlreadyExists() {
        return new ApiException(HttpStatus.CONFLICT, "Username already exists.");
    }

    public static ApiException emailAlreadyExists() {
        return new ApiException(HttpStatus.CONFLICT, "Email already exists.");
    }

    public static ApiException passwordMatchesIdentifier() {
        return new ApiException(
                HttpStatus.BAD_REQUEST,
                "Password must not match an account identifier.",
                "password_matches_identifier"
        );
    }

    public static ApiException invalidCredentials() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "Invalid email or password.");
    }

    // Deliberately generic — never distinguishes "expired" from "already used" from "never
    // existed", so the endpoint can't be used to probe the state of a specific link.
    public static ApiException invalidOrExpiredResetToken() {
        return new ApiException(HttpStatus.BAD_REQUEST, "Invalid or expired reset token.");
    }

    // Same anti-enumeration reasoning as invalidOrExpiredResetToken().
    public static ApiException invalidOrExpiredVerificationToken() {
        return new ApiException(HttpStatus.BAD_REQUEST, "Invalid or expired verification token.");
    }

    public static ApiException emailAlreadyVerified() {
        return new ApiException(HttpStatus.CONFLICT, "Email already verified.");
    }

    // 422, not 400: this distinct status lets the frontend show an actionable breach-check message
    // without confusing it with unrelated request-validation errors. The identifier policy uses a
    // stable ProblemDetail code because it shares the 400 status with those other failures.
    public static ApiException passwordCompromised() {
        return new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "Password found in a known data breach.");
    }
}
