package com.proustclub.quote.model;

public record QuoteListEntry(QuoteSelection quote, int volumeId, int pageNumber, String volume, String part) {}
