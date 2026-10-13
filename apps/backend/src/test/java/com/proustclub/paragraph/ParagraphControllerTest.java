package com.proustclub.paragraph;

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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class ParagraphControllerTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    DSLContext dsl;

    // Volume 1 (Du Côté de Chez Swann), part 1 (Combray): positions 1-5.
    // Volume 2 (À l'Ombre des Jeunes Filles en Fleurs), part 4 (Autour de Mme Swann): position 6 —
    // right after volume 1's last paragraph by position, used to prove the volume boundary holds.
    @BeforeEach
    void setUp() {
        dsl.insertInto(DSL.table("paragraphs"),
                        DSL.field("volume_id"), DSL.field("part_id"), DSL.field("position"),
                        DSL.field("page_number"), DSL.field("text"))
                .values(1, 1, 1, 1, "P1")
                .values(1, 1, 2, 1, "P2")
                .values(1, 1, 3, 2, "P3")
                .values(1, 1, 4, 2, "P4")
                .values(1, 1, 5, 3, "P5")
                .values(2, 4, 6, 104, "P6")
                .execute();
    }

    @AfterEach
    void tearDown() {
        dsl.deleteFrom(DSL.table("paragraphs")).execute();
    }

    private int paragraphIdAtPosition(int position) {
        return dsl.select(DSL.field("id", Integer.class))
                .from(DSL.table("paragraphs"))
                .where(DSL.field("position", Integer.class).eq(position))
                .fetchOne(0, Integer.class);
    }

    @Test
    void contextInTheMiddleOfAVolumeReturnsBothSidesWithMore() throws Exception {
        int p3 = paragraphIdAtPosition(3);

        mockMvc.perform(get("/api/paragraphs/{id}/context", p3).param("before", "1").param("after", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paragraphId").value(p3))
                .andExpect(jsonPath("$.before.length()").value(1))
                .andExpect(jsonPath("$.before[0].text").value("P2"))
                .andExpect(jsonPath("$.after.length()").value(1))
                .andExpect(jsonPath("$.after[0].text").value("P4"))
                .andExpect(jsonPath("$.hasMoreBefore").value(true))
                .andExpect(jsonPath("$.hasMoreAfter").value(true));
    }

    @Test
    void contextOrdersBeforeOldestFirst() throws Exception {
        int p4 = paragraphIdAtPosition(4);

        mockMvc.perform(get("/api/paragraphs/{id}/context", p4).param("before", "3"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.before.length()").value(3))
                .andExpect(jsonPath("$.before[0].text").value("P1"))
                .andExpect(jsonPath("$.before[1].text").value("P2"))
                .andExpect(jsonPath("$.before[2].text").value("P3"))
                .andExpect(jsonPath("$.hasMoreBefore").value(false));
    }

    @Test
    void contextAtTheStartOfAVolumeHasNoBefore() throws Exception {
        int p1 = paragraphIdAtPosition(1);

        mockMvc.perform(get("/api/paragraphs/{id}/context", p1).param("before", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.before.length()").value(0))
                .andExpect(jsonPath("$.hasMoreBefore").value(false));
    }

    @Test
    void contextAtTheEndOfAVolumeNeverCrossesIntoTheNextVolume() throws Exception {
        int p5 = paragraphIdAtPosition(5);

        mockMvc.perform(get("/api/paragraphs/{id}/context", p5).param("after", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.after.length()").value(0))
                .andExpect(jsonPath("$.hasMoreAfter").value(false));
    }

    @Test
    void contextWithZeroBeforeAfterStillReportsHasMore() throws Exception {
        int p3 = paragraphIdAtPosition(3);

        mockMvc.perform(get("/api/paragraphs/{id}/context", p3))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.before.length()").value(0))
                .andExpect(jsonPath("$.after.length()").value(0))
                .andExpect(jsonPath("$.hasMoreBefore").value(true))
                .andExpect(jsonPath("$.hasMoreAfter").value(true));
    }

    @Test
    void contextForUnknownParagraphReturnsNotFound() throws Exception {
        mockMvc.perform(get("/api/paragraphs/{id}/context", 999999999))
                .andExpect(status().isNotFound());
    }

    @Test
    void contextBeforeOverMaximumReturnsBadRequest() throws Exception {
        int p3 = paragraphIdAtPosition(3);

        mockMvc.perform(get("/api/paragraphs/{id}/context", p3).param("before", "21"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void contextNegativeAfterReturnsBadRequest() throws Exception {
        int p3 = paragraphIdAtPosition(3);

        mockMvc.perform(get("/api/paragraphs/{id}/context", p3).param("after", "-1"))
                .andExpect(status().isBadRequest());
    }
}
