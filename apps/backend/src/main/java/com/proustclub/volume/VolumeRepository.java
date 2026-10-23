package com.proustclub.volume;

import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

import java.util.List;

import static com.proustclub.jooq.Tables.VOLUMES;

@Repository
class VolumeRepository {

    private final DSLContext dsl;

    VolumeRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    List<VolumeData> findAll() {
        return dsl.select(VOLUMES.ID, VOLUMES.TITLE, VOLUMES.POSITION, VOLUMES.MIN_PAGE, VOLUMES.MAX_PAGE)
                .from(VOLUMES)
                .orderBy(VOLUMES.POSITION)
                .fetch(r -> new VolumeData(
                        r.get(VOLUMES.ID), r.get(VOLUMES.TITLE), r.get(VOLUMES.POSITION),
                        r.get(VOLUMES.MIN_PAGE), r.get(VOLUMES.MAX_PAGE)
                ));
    }
}
