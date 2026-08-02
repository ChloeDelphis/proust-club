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

    static ApiException invalidCredentials() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "Invalid username or password.");
    }
}
