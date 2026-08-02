package com.proustclub.importer;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ParagraphParserTest {

    private final ParagraphParser parser = new ParagraphParser();

    @Test
    void ignoresPrefaceBeforeFirstSectionMarker() {
        var lines = """
                Marcel Proust

                A la recherche du temps perdu

                001 | 1. Du Côté de Chez Swann

                Longtemps, je me suis couché de bonne heure.
                """;
        var result = parse(lines);
        assertThat(result).hasSize(1);
        assertThat(result.get(0).text()).isEqualTo("Longtemps, je me suis couché de bonne heure.");
        assertThat(result.get(0).pageNumber()).isEqualTo(1);
    }

    @Test
    void sectionMarkerUpdatesPageAndIsNotIncluded() {
        var lines = """
                001 | 1. Du Côté de Chez Swann

                Premier paragraphe.

                012

                Deuxième paragraphe.
                """;
        var result = parse(lines);
        assertThat(result).hasSize(2);
        assertThat(result.get(0).pageNumber()).isEqualTo(1);
        assertThat(result.get(1).pageNumber()).isEqualTo(12);
    }

    @Test
    void standalonePageMarkerUpdatesPageNumber() {
        var lines = """
                001 | 1. Du Côté de Chez Swann

                Page un.

                002

                Page deux.
                """;
        var result = parse(lines);
        assertThat(result).hasSize(2);
        assertThat(result.get(1).pageNumber()).isEqualTo(2);
    }

    @Test
    void skipsRomanNumeralsAlone() {
        var lines = """
                001 | 1. Du Côté de Chez Swann

                I.

                II.

                Texte réel.

                III

                Autre texte.
                """;
        var result = parse(lines);
        assertThat(result).hasSize(2);
        assertThat(result.get(0).text()).isEqualTo("Texte réel.");
        assertThat(result.get(1).text()).isEqualTo("Autre texte.");
    }

    @Test
    void skipsVolumeTitleRepetitions() {
        var lines = """
                001 | 1. Du Côté de Chez Swann

                1. Du Côté de Chez Swann

                Texte réel.
                """;
        var result = parse(lines);
        assertThat(result).hasSize(1);
        assertThat(result.get(0).text()).isEqualTo("Texte réel.");
    }

    @Test
    void skipsPartTitleRepetitions() {
        var lines = """
                001 | 1. Du Côté de Chez Swann

                Première partie : Combray

                Texte réel.

                044 | 2. À l'Ombre des Jeunes Filles

                Deuxième partie : Autour de Mme Swann

                Autre texte.
                """;
        var result = parse(lines);
        assertThat(result).hasSize(2);
        assertThat(result.get(0).text()).isEqualTo("Texte réel.");
        assertThat(result.get(1).text()).isEqualTo("Autre texte.");
    }

    @Test
    void stopsAtFinMarker() {
        var lines = """
                001 | 1. Du Côté de Chez Swann

                Longtemps, je me suis couché de bonne heure.

                487 | Fin

                Ce texte ne doit pas apparaître.
                """;
        var result = parse(lines);
        assertThat(result).hasSize(1);
        assertThat(result.get(0).text()).isEqualTo("Longtemps, je me suis couché de bonne heure.");
    }

    @Test
    void joinsMultiLineParagraphs() {
        var lines = """
                001 | 1. Du Côté de Chez Swann

                Longtemps, je me suis
                couché de bonne heure.
                """;
        var result = parse(lines);
        assertThat(result).hasSize(1);
        assertThat(result.get(0).text()).isEqualTo("Longtemps, je me suis couché de bonne heure.");
    }

    @Test
    void doesNotCreateEmptyParagraphs() {
        var lines = """
                001 | 1. Du Côté de Chez Swann



                Texte réel.


                """;
        var result = parse(lines);
        assertThat(result).hasSize(1);
    }

    @Test
    void emptyInputReturnsNoResults() {
        assertThat(parse("")).isEmpty();
    }

    @Test
    void preservesParagraphOrder() {
        var lines = """
                001 | premier

                A.

                B.

                C.
                """;
        var result = parse(lines);
        assertThat(result).extracting(ParsedParagraph::text)
                .containsExactly("A.", "B.", "C.");
    }

    @Test
    void skipsChapterHeadings() {
        var lines = """
                001 | 1. Du Côté de Chez Swann

                CHAPITRE PREMIER

                Texte réel.

                044 | 2. À l'Ombre des Jeunes Filles

                CHAPITRE II

                Autre texte.
                """;
        var result = parse(lines);
        assertThat(result).hasSize(2);
        assertThat(result.get(0).text()).isEqualTo("Texte réel.");
        assertThat(result.get(1).text()).isEqualTo("Autre texte.");
    }

    @Test
    void romanNumeralInMiddleOfTextIsKept() {
        var lines = """
                001 | debut

                Il était I. fois un roi.
                """;
        var result = parse(lines);
        // "Il était I. fois un roi." ne correspond pas à ^[IVX]+\\.?\\s*$ donc doit être conservé
        assertThat(result).hasSize(1);
        assertThat(result.get(0).text()).isEqualTo("Il était I. fois un roi.");
    }

    private List<ParsedParagraph> parse(String text) {
        return parser.parseLines(text.lines());
    }
}
