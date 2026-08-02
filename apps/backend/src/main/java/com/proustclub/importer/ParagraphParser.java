package com.proustclub.importer;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
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
        final int[] currentPage = {0};
        final boolean[] reachedContent = {false};
        final boolean[] finished = {false};

        lines.forEach(rawLine -> {
            if (finished[0]) return;

            String line = rawLine.stripTrailing();

            var sectionMatch = SECTION_MARKER.matcher(line);
            if (sectionMatch.matches()) {
                flushBuffer(buffer, currentPage[0], result);
                String title = sectionMatch.group(2).trim();
                if ("Fin".equals(title)) {
                    finished[0] = true;
                    return;
                }
                currentPage[0] = Integer.parseInt(sectionMatch.group(1));
                reachedContent[0] = true;
                return;
            }

            if (!reachedContent[0]) return;

            if (PAGE_MARKER.matcher(line).matches()) {
                flushBuffer(buffer, currentPage[0], result);
                currentPage[0] = Integer.parseInt(line);
                return;
            }

            if (line.isBlank()) {
                flushBuffer(buffer, currentPage[0], result);
                return;
            }

            if (ROMAN_NUMERAL.matcher(line).matches()) return;
            if (VOLUME_TITLE.matcher(line).find()) return;
            if (PART_TITLE.matcher(line).find()) return;
            if (CHAPTER_HEADING.matcher(line).find()) return;

            if (!buffer.isEmpty()) buffer.append(' ');
            buffer.append(line.strip());
        });

        flushBuffer(buffer, currentPage[0], result);
        log.info("Parsing terminé : {} paragraphes extraits", result.size());
        return result;
    }

    private void flushBuffer(StringBuilder buffer, int page, List<ParsedParagraph> result) {
        if (buffer.isEmpty()) return;
        result.add(new ParsedParagraph(page, buffer.toString()));
        buffer.setLength(0);
    }
}
