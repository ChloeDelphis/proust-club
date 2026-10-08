package com.proustclub.importer;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.Stream;

@Component
public class ParagraphParser {

    private static final Logger log = LoggerFactory.getLogger(ParagraphParser.class);

    // "001 | 1. Du Côté de Chez Swann" — section marker, group 1 = page, group 2 = title
    private static final Pattern SECTION_MARKER = Pattern.compile("^(\\d{3}) \\| (.+)$");
    // "042" alone — standalone page number
    private static final Pattern PAGE_MARKER = Pattern.compile("^\\d{3}$");
    // "I.", "II.", "III" alone — chapter/subsection numbers
    private static final Pattern ROMAN_NUMERAL = Pattern.compile("^[IVX]+\\.?\\s*$");
    // "1. Du Côté de Chez Swann", "2. À l'Ombre..." — volume title repetitions after section marker
    private static final Pattern VOLUME_TITLE = Pattern.compile("^\\d+\\. [A-ZÀ-Ÿ]");
    // "Première partie : Combray" — part title repetitions after section marker
    private static final Pattern PART_TITLE = Pattern.compile(
            "^(Première|Deuxième|Troisième|Quatrième|Cinquième|Sixième|Septième) partie",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE
    );
    // "CHAPITRE II", "CHAPITRE PREMIER" — chapter headings within parts
    private static final Pattern CHAPTER_HEADING = Pattern.compile("^CHAPITRE\\b");

    public List<ParsedParagraph> parse(Path filePath) throws IOException {
        log.info("Lecture du fichier : {}", filePath.toAbsolutePath());
        try (Stream<String> lines = Files.lines(filePath, StandardCharsets.UTF_8)) {
            return parseLines(lines);
        }
    }

    List<ParsedParagraph> parseLines(Stream<String> lines) {
        var result = new ArrayList<ParsedParagraph>();
        var buffer = new StringBuilder();
        int currentPage = 0;
        boolean reachedContent = false;

        // A plain Iterator, not lines.toList(), so the corpus file is still streamed one line at a
        // time from Files.lines()'s underlying BufferedReader rather than fully materialized in
        // memory before the first line is even processed.
        Iterator<String> it = lines.iterator();
        while (it.hasNext()) {
            String line = it.next().stripTrailing();

            var sectionMatch = SECTION_MARKER.matcher(line);
            if (sectionMatch.matches()) {
                flushBuffer(buffer, currentPage, result);
                String title = sectionMatch.group(2).trim();
                if ("Fin".equals(title)) break;
                currentPage = Integer.parseInt(sectionMatch.group(1));
                reachedContent = true;
                continue;
            }

            if (!reachedContent) continue;

            if (PAGE_MARKER.matcher(line).matches()) {
                flushBuffer(buffer, currentPage, result);
                currentPage = Integer.parseInt(line);
                continue;
            }

            if (line.isBlank()) {
                flushBuffer(buffer, currentPage, result);
                continue;
            }

            if (isNoiseLine(line)) continue;

            if (!buffer.isEmpty()) buffer.append(' ');
            buffer.append(line.strip());
        }

        flushBuffer(buffer, currentPage, result);
        log.info("Parsing terminé : {} paragraphes extraits", result.size());
        return result;
    }

    // Lines that are typographic repetitions (chapter/subsection markers, title repeats) rather
    // than actual paragraph content — none of them carry page/section state, so they're a pure
    // classification concern, unlike the markers above which also drive state transitions.
    private static boolean isNoiseLine(String line) {
        return ROMAN_NUMERAL.matcher(line).matches()
                || VOLUME_TITLE.matcher(line).find()
                || PART_TITLE.matcher(line).find()
                || CHAPTER_HEADING.matcher(line).find();
    }

    private void flushBuffer(StringBuilder buffer, int page, List<ParsedParagraph> result) {
        if (buffer.isEmpty()) return;
        result.add(new ParsedParagraph(page, buffer.toString()));
        buffer.setLength(0);
    }
}
