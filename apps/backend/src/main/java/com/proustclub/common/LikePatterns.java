package com.proustclub.common;

public final class LikePatterns {

    private LikePatterns() {
    }

    // Escapes %, _ and \ which have special meaning in SQL LIKE patterns
    public static String escape(String q) {
        return q.replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_");
    }
}
