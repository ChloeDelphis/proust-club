package com.proustclub.tag;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;

public class TagApiException extends ErrorResponseException {

    private TagApiException(HttpStatus status, String detail) {
        super(status, ProblemDetail.forStatusAndDetail(status, detail), null);
    }

    public static TagApiException tagNotFound() {
        return new TagApiException(HttpStatus.NOT_FOUND, "Tag not found.");
    }

    public static TagApiException tagAlreadyExists() {
        return new TagApiException(HttpStatus.CONFLICT, "Tag already exists.");
    }

    public static TagApiException tagNameBlank() {
        return new TagApiException(HttpStatus.BAD_REQUEST, "Tag name must not be blank.");
    }
}
