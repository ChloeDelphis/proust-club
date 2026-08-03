package com.proustclub.quote;

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

    static ApiException selectionMismatch() {
        return new ApiException(HttpStatus.BAD_REQUEST, "Selected text does not match the paragraph at the given offsets.");
    }

    static ApiException quoteNotFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "Quote not found.");
    }

    static ApiException tagNotFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "Tag not found.");
    }

    static ApiException tagAlreadyExists() {
        return new ApiException(HttpStatus.CONFLICT, "Tag already exists.");
    }
}
