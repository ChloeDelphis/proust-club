package com.proustclub.paragraph;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;

class ApiException extends ErrorResponseException {

    private ApiException(HttpStatus status, String detail) {
        super(status, ProblemDetail.forStatusAndDetail(status, detail), null);
    }

    static ApiException paragraphNotFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "Paragraph not found.");
    }
}
