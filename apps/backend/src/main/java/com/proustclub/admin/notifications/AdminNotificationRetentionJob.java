package com.proustclub.admin.notifications;

import com.proustclub.admin.AdminDataRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;

@Component
public class AdminNotificationRetentionJob {

    private static final Logger log = LoggerFactory.getLogger(AdminNotificationRetentionJob.class);
    private static final int BATCH_SIZE = 500;
    private static final int MAX_BATCHES_PER_RUN = 20;

    private final AdminDataRepository repository;
    private final int retentionDays;

    public AdminNotificationRetentionJob(
            AdminDataRepository repository,
            @Value("${app.admin.notifications.retention-days:30}") int retentionDays) {
        if (retentionDays < 1) throw new IllegalArgumentException("Admin notification retention must be positive.");
        this.repository = repository;
        this.retentionDays = retentionDays;
    }

    @Scheduled(cron = "0 15 3 * * *", zone = "UTC")
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public void purgeExpiredNotifications() {
        var cutoff = OffsetDateTime.now(ZoneOffset.UTC).minusDays(retentionDays);
        int totalDeleted = 0;
        int batchCount = 0;
        int lastBatchSize = 0;

        while (batchCount < MAX_BATCHES_PER_RUN) {
            lastBatchSize = repository.purgeCompletedNotificationsBefore(cutoff, BATCH_SIZE);
            totalDeleted += lastBatchSize;
            batchCount++;
            if (lastBatchSize < BATCH_SIZE) break;
        }

        boolean batchLimitReached = batchCount == MAX_BATCHES_PER_RUN && lastBatchSize == BATCH_SIZE;
        log.info("Admin notification retention purge completed (deletedCount={}, batches={}, batchLimitReached={})",
                totalDeleted, batchCount, batchLimitReached);
    }
}
