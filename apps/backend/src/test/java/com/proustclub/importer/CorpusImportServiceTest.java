package com.proustclub.importer;

import com.proustclub.TestcontainersConfiguration;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
class CorpusImportServiceTest {

    @Autowired
    CorpusImportService service;

    @Autowired
    DSLContext dsl;

    @BeforeEach
    void setUp() {
        // The Testcontainers context (and its database) is shared across integration test
        // classes — start from a clean paragraphs table so updateVolumePageRanges() only
        // aggregates the rows this test itself inserts.
        dsl.deleteFrom(DSL.table("paragraphs")).execute();
    }

    @AfterEach
    void tearDown() {
        dsl.deleteFrom(DSL.table("paragraphs")).execute();
    }

    @Test
    void importPersistsPerVolumePageRanges() {
        // Page 1 falls in volume 1's part 1 (start_page 1); page 110 falls in volume 2's
        // part 4 (start_page 104) — see V2__corpus_seed.sql.
        var paragraphs = List.of(
                new ParsedParagraph(1, "Premier paragraphe, tome 1."),
                new ParsedParagraph(50, "Second paragraphe, toujours tome 1."),
                new ParsedParagraph(110, "Troisième paragraphe, tome 2.")
        );

        service.importParagraphs(paragraphs);

        var idField = DSL.field("id", Integer.class);
        var minPageField = DSL.field("min_page", Integer.class);
        var maxPageField = DSL.field("max_page", Integer.class);

        var volume1 = dsl.select(minPageField, maxPageField)
                .from(DSL.table("volumes"))
                .where(idField.eq(1))
                .fetchOne();
        assertThat(volume1.get(minPageField)).isEqualTo(1);
        assertThat(volume1.get(maxPageField)).isEqualTo(50);

        var volume2 = dsl.select(minPageField, maxPageField)
                .from(DSL.table("volumes"))
                .where(idField.eq(2))
                .fetchOne();
        assertThat(volume2.get(minPageField)).isEqualTo(110);
        assertThat(volume2.get(maxPageField)).isEqualTo(110);
    }
}
