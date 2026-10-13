package com.proustclub.common;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;

// Shared by quote (saving a quote against an unknown paragraph) and paragraph (reading context
// around an unknown paragraph) — the same "this paragraph doesn't exist" case, promoted here once
// a second feature needed it, same reasoning as LikePatterns.
public final class ParagraphExceptions {

    private ParagraphExceptions() {
    }

    public static ErrorResponseException notFound() {
        return new ErrorResponseException(HttpStatus.NOT_FOUND, ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, "Paragraph not found."), null);
    }
}
