package com.proustclub.search;

import java.text.BreakIterator;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

final class SearchPreviewText {

    private static final int WORD_LIMIT = 5;

    private SearchPreviewText() {}

    static String aroundMatch(String textWindow, int matchOffsetCodePoints, int matchLengthCodePoints) {
        int matchStart = textWindow.offsetByCodePoints(0, matchOffsetCodePoints);
        int matchEnd = textWindow.offsetByCodePoints(matchStart, matchLengthCodePoints);
        var words = wordRanges(textWindow);
        if (words.isEmpty()) return textWindow.strip();

        int firstMatchWord = findFirstWord(words, matchStart, matchEnd);
        if (firstMatchWord < 0) return textWindow.substring(words.get(0)[0], words.get(Math.min(WORD_LIMIT, words.size()) - 1)[1]).strip();

        int startWord = Math.max(0, firstMatchWord - WORD_LIMIT / 2);
        int endWord = Math.min(words.size(), startWord + WORD_LIMIT);
        if (endWord - startWord < WORD_LIMIT) startWord = Math.max(0, endWord - WORD_LIMIT);

        String snippet = textWindow.substring(words.get(startWord)[0], words.get(endWord - 1)[1]).strip();
        return (startWord > 0 ? "… " : "") + snippet + (endWord < words.size() ? " …" : "");
    }

    private static List<int[]> wordRanges(String text) {
        var result = new ArrayList<int[]>();
        var iterator = BreakIterator.getWordInstance(Locale.FRENCH);
        iterator.setText(text);
        int start = iterator.first();
        for (int end = iterator.next(); end != BreakIterator.DONE; start = end, end = iterator.next()) {
            if (text.substring(start, end).codePoints().anyMatch(Character::isLetterOrDigit)) {
                result.add(new int[]{start, end});
            }
        }
        return result;
    }

    private static int findFirstWord(List<int[]> words, int matchStart, int matchEnd) {
        for (int index = 0; index < words.size(); index++) {
            if (words.get(index)[1] > matchStart && words.get(index)[0] < matchEnd) return index;
        }
        return -1;
    }

}
