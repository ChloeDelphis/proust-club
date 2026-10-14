package com.proustclub.search;

import com.proustclub.TestcontainersConfiguration;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class SearchControllerTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    DSLContext dsl;

    @BeforeEach
    void setUp() {
        // volume_id=1 (Du côté de chez Swann), part_id=1 (Combray)
        // Paragraphe 1 : "madeleine" à startOffset=3, endOffset=12
        //   strpos(lower("La madeleine..."), "madeleine") = 4 (1-based) → 3 (0-based)
        // Paragraphe 2 : "madeleine" à startOffset=12, endOffset=21
        //   strpos(lower("Il revit la madeleine..."), "madeleine") = 13 (1-based) → 12 (0-based)
        // Paragraphe 3 : pas de "madeleine"
        dsl.insertInto(DSL.table("paragraphs"),
                        DSL.field("volume_id"), DSL.field("part_id"), DSL.field("position"),
                        DSL.field("page_number"), DSL.field("text"))
                .values(1, 1, 1, 1, "La madeleine est un symbole fort chez Proust.")
                .values(1, 1, 2, 1, "Il revit la madeleine trempée dans le thé.")
                .values(1, 1, 3, 2, "Longtemps, je me suis couché de bonne heure.")
                .execute();
    }

    @AfterEach
    void tearDown() {
        dsl.deleteFrom(DSL.table("paragraphs")).execute();
    }

    @Test
    void searchReturnsMatchingParagraphs() throws Exception {
        mockMvc.perform(get("/api/search").param("q", "madeleine"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(2))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(10))
                .andExpect(jsonPath("$.results.length()").value(2));
    }

    @Test
    void searchReturnsCorrectOffsets() throws Exception {
        // Premier résultat : "La madeleine..." → startOffset=3, endOffset=12
        mockMvc.perform(get("/api/search").param("q", "madeleine"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results[0].startOffset").value(3))
                .andExpect(jsonPath("$.results[0].endOffset").value(12));
    }

    @Test
    void searchOffsetsUseUtf16IndexesAfterSupplementaryCharacters() throws Exception {
        String text = "😀xneedle";
        dsl.insertInto(DSL.table("paragraphs"),
                        DSL.field("volume_id"), DSL.field("part_id"), DSL.field("position"),
                        DSL.field("page_number"), DSL.field("text"))
                .values(1, 1, 4, 2, text)
                .execute();

        mockMvc.perform(get("/api/search").param("q", "needle"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results[0].text").value(text))
                .andExpect(jsonPath("$.results[0].startOffset").value(3))
                .andExpect(jsonPath("$.results[0].endOffset").value(9));
    }

    @Test
    void searchReturnsLocationMetadata() throws Exception {
        mockMvc.perform(get("/api/search").param("q", "madeleine"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results[0].volume").value("Du côté de chez Swann"))
                .andExpect(jsonPath("$.results[0].part").value("Combray"))
                .andExpect(jsonPath("$.results[0].pageNumber").value(1));
    }

    @Test
    void searchIsCaseInsensitive() throws Exception {
        mockMvc.perform(get("/api/search").param("q", "MADELEINE"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(2));
    }

    @Test
    void searchNoResults() throws Exception {
        mockMvc.perform(get("/api/search").param("q", "Dostoïevski"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(0))
                .andExpect(jsonPath("$.results.length()").value(0));
    }

    @Test
    void searchPagination() throws Exception {
        mockMvc.perform(get("/api/search").param("q", "la").param("page", "0").param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.length()").value(1))
                .andExpect(jsonPath("$.size").value(1))
                .andExpect(jsonPath("$.page").value(0));
    }

    @Test
    void searchPaginationPreservesParagraphIdentityAndReadingOrderAcrossPages() throws Exception {
        int fifthId = insertParagraph(105, "Fifth pagination-contract-match paragraph.");
        int firstId = insertParagraph(101, "First pagination-contract-match paragraph.");
        int thirdId = insertParagraph(103, "Third pagination-contract-match paragraph.");
        int secondId = insertParagraph(102, "Second pagination-contract-match paragraph.");
        int fourthId = insertParagraph(104, "Fourth pagination-contract-match paragraph.");

        assertSearchPage(0, List.of(firstId, secondId), List.of(
                "First pagination-contract-match paragraph.",
                "Second pagination-contract-match paragraph."));
        assertSearchPage(1, List.of(thirdId, fourthId), List.of(
                "Third pagination-contract-match paragraph.",
                "Fourth pagination-contract-match paragraph."));
        assertSearchPage(2, List.of(fifthId), List.of("Fifth pagination-contract-match paragraph."));
    }

    @Test
    void searchEscapesLikeSpecialChars() throws Exception {
        mockMvc.perform(get("/api/search").param("q", "100% Proust"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(0));
    }

    // detail not asserted below — same MockMvc limitation as ErrorHandlingIntegrationTest
    // (the descriptive message is verified manually against a real running server instead).
    @Test
    void searchQueryTooShortReturnsBadRequest() throws Exception {
        mockMvc.perform(get("/api/search").param("q", "a"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void searchQueryBlankReturnsBadRequest() throws Exception {
        mockMvc.perform(get("/api/search").param("q", "  "))
                .andExpect(status().isBadRequest());
    }

    @Test
    void searchSizeTooLargeReturnsBadRequest() throws Exception {
        mockMvc.perform(get("/api/search").param("q", "madeleine").param("size", "21"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void searchMissingQueryReturnsBadRequest() throws Exception {
        mockMvc.perform(get("/api/search"))
                .andExpect(status().isBadRequest());
    }

    private int insertParagraph(int position, String text) {
        dsl.insertInto(DSL.table("paragraphs"),
                        DSL.field("volume_id"), DSL.field("part_id"), DSL.field("position"),
                        DSL.field("page_number"), DSL.field("text"))
                .values(1, 1, position, 10, text)
                .execute();
        return dsl.select(DSL.field("id", Integer.class))
                .from(DSL.table("paragraphs"))
                .where(DSL.field("position", Integer.class).eq(position))
                .fetchOne(0, int.class);
    }

    private void assertSearchPage(int page, List<Integer> paragraphIds, List<String> texts) throws Exception {
        var result = mockMvc.perform(get("/api/search")
                        .param("q", "pagination-contract-match")
                        .param("page", Integer.toString(page))
                        .param("size", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(5))
                .andExpect(jsonPath("$.page").value(page))
                .andExpect(jsonPath("$.size").value(2))
                .andExpect(jsonPath("$.results.length()").value(paragraphIds.size()));

        for (int index = 0; index < paragraphIds.size(); index++) {
            result.andExpect(jsonPath("$.results[" + index + "].paragraphId").value(paragraphIds.get(index)))
                    .andExpect(jsonPath("$.results[" + index + "].text").value(texts.get(index)));
        }
    }
}
