package com.proustclub.volume;

import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static com.proustclub.jooq.Tables.PARTS;
import static com.proustclub.jooq.Tables.VOLUMES;

@Repository
class VolumeRepository {

    private final DSLContext dsl;

    VolumeRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    List<VolumeData> findAll() {
        Map<Integer, VolumeBuilder> volumes = new LinkedHashMap<>();
        var rows = dsl.select(
                        VOLUMES.ID, VOLUMES.TITLE, VOLUMES.POSITION, VOLUMES.MIN_PAGE, VOLUMES.MAX_PAGE,
                        PARTS.ID, PARTS.TITLE, PARTS.POSITION, PARTS.START_PAGE)
                .from(VOLUMES)
                .leftJoin(PARTS).on(PARTS.VOLUME_ID.eq(VOLUMES.ID))
                .orderBy(VOLUMES.POSITION, PARTS.POSITION)
                .fetch();
        for (var row : rows) {
            var volume = volumes.computeIfAbsent(row.get(VOLUMES.ID), ignored -> new VolumeBuilder(
                    row.get(VOLUMES.ID), row.get(VOLUMES.TITLE), row.get(VOLUMES.POSITION),
                    row.get(VOLUMES.MIN_PAGE), row.get(VOLUMES.MAX_PAGE)));
            if (row.get(PARTS.ID) != null) {
                volume.parts.add(new PartData(
                        row.get(PARTS.ID), row.get(PARTS.TITLE), row.get(PARTS.POSITION), row.get(PARTS.START_PAGE)));
            }
        }
        return volumes.values().stream().map(VolumeBuilder::build).toList();
    }

    private static class VolumeBuilder {
        private final int id;
        private final String title;
        private final int position;
        private final int minPage;
        private final int maxPage;
        private final List<PartData> parts = new ArrayList<>();

        private VolumeBuilder(int id, String title, int position, int minPage, int maxPage) {
            this.id = id;
            this.title = title;
            this.position = position;
            this.minPage = minPage;
            this.maxPage = maxPage;
        }

        private VolumeData build() {
            return new VolumeData(id, title, position, minPage, maxPage, List.copyOf(parts));
        }
    }
}
