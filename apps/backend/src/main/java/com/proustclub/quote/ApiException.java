package com.proustclub.quote;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;

class ApiException extends ErrorResponseException {

    private ApiException(HttpStatus status, String detail) {
        super(status, ProblemDetail.forStatusAndDetail(status, detail), null);
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

    static ApiException tagNameBlank() {
        return new ApiException(HttpStatus.BAD_REQUEST, "Tag name must not be blank.");
    }

    static ApiException quoteTagLimitReached() {
        return new ApiException(HttpStatus.CONFLICT, "Quote already has the maximum number of tags.");
    }

    static ApiException tooManyTagsInRequest() {
        return new ApiException(HttpStatus.BAD_REQUEST, "A quote cannot have more than 20 tags.");
    }
}
