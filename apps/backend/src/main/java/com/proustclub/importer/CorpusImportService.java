package com.proustclub.importer;

import org.jooq.DSLContext;
import org.jooq.Query;
import org.jooq.impl.DSL;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

import static com.proustclub.jooq.Tables.PARAGRAPHS;
import static com.proustclub.jooq.Tables.PARTS;
import static com.proustclub.jooq.Tables.VOLUMES;

@Service
public class CorpusImportService {

    private static final Logger log = LoggerFactory.getLogger(CorpusImportService.class);

    private final DSLContext dsl;

    public CorpusImportService(DSLContext dsl) {
        this.dsl = dsl;
    }

    public boolean isAlreadyImported() {
        return dsl.fetchCount(PARAGRAPHS) > 0;
    }

    @Transactional
    public void importParagraphs(List<ParsedParagraph> paragraphs) {
        var partRanges = loadPartRanges();
        log.info("Chargé {} plages de parties", partRanges.size());

        var data = buildInsertData(paragraphs, partRanges);
        log.info("Préparation de {} paragraphes...", data.size());

        batchInsert(data);
        updateVolumePageRanges();

        log.info("Import terminé : {} paragraphes insérés", data.size());
    }

    private void updateVolumePageRanges() {
        var ranges = dsl.select(
                        PARAGRAPHS.VOLUME_ID,
                        DSL.min(PARAGRAPHS.PAGE_NUMBER).as("min_page_agg"),
                        DSL.max(PARAGRAPHS.PAGE_NUMBER).as("max_page_agg"))
                .from(PARAGRAPHS)
                .groupBy(PARAGRAPHS.VOLUME_ID)
                .asTable("ranges");

        dsl.update(VOLUMES)
                .set(VOLUMES.MIN_PAGE, ranges.field("min_page_agg", Integer.class))
                .set(VOLUMES.MAX_PAGE, ranges.field("max_page_agg", Integer.class))
                .from(ranges)
                .where(VOLUMES.ID.eq(ranges.field(PARAGRAPHS.VOLUME_ID)))
                .execute();

        log.info("Bornes de page des tomes recalculées");
    }

    private List<PartRange> loadPartRanges() {
        return dsl.select(
                        PARTS.ID,
                        PARTS.VOLUME_ID,
                        PARTS.START_PAGE)
                .from(PARTS)
                .orderBy(PARTS.START_PAGE.desc())
                .fetch(r -> new PartRange(r.value1(), r.value2(), r.value3()));
    }

    private List<ParagraphData> buildInsertData(List<ParsedParagraph> paragraphs, List<PartRange> partRanges) {
        var result = new ArrayList<ParagraphData>(paragraphs.size());
        int position = 1;
        for (var p : paragraphs) {
            var part = findPart(partRanges, p.pageNumber());
            result.add(new ParagraphData(part.volumeId(), part.id(), position++, p.pageNumber(), p.text()));
        }
        return result;
    }

    private PartRange findPart(List<PartRange> partRanges, int pageNumber) {
        // partRanges est trié par start_page DESC : le premier dont start_page <= page est la bonne partie
        return partRanges.stream()
                .filter(pr -> pr.startPage() <= pageNumber)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Aucune partie trouvée pour la page " + pageNumber));
    }

    private void batchInsert(List<ParagraphData> data) {
        List<Query> queries = new ArrayList<>(data.size());
        for (var p : data) {
            queries.add(dsl.insertInto(PARAGRAPHS,
                    PARAGRAPHS.VOLUME_ID,
                    PARAGRAPHS.PART_ID,
                    PARAGRAPHS.POSITION,
                    PARAGRAPHS.PAGE_NUMBER,
                    PARAGRAPHS.TEXT)
                    .values(p.volumeId(), p.partId(), p.position(), p.pageNumber(), p.text()));
        }
        dsl.batch(queries).execute();
    }

    record PartRange(int id, int volumeId, int startPage) {}

    record ParagraphData(int volumeId, int partId, int position, int pageNumber, String text) {}
}
