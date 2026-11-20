package com.proustclub.admin;

import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

@RestController
class AdminDashboardController {

    private final AdminDataRepository repository;

    AdminDashboardController(AdminDataRepository repository) {
        this.repository = repository;
    }

    @GetMapping(value = "/api/admin/dashboard", produces = MediaType.APPLICATION_JSON_VALUE)
    AdminDashboard dashboard() {
        var today = LocalDate.now(ZoneOffset.UTC);
        var start = today.minusDays(29);
        var preferences = repository.notificationPreferences();
        return new AdminDashboard(repository.registeredUserCount(), repository.quoteCount(), repository.tagCount(),
                repository.recentMetrics(start), preferences, start, today);
    }

    @GetMapping(value = "/api/admin/notifications", produces = MediaType.APPLICATION_JSON_VALUE)
    AdminNotificationPreferences notificationPreferences() {
        return repository.notificationPreferences();
    }

    @PatchMapping(value = "/api/admin/notifications", consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    AdminNotificationPreferences updateNotificationPreferences(@Valid @RequestBody NotificationPreferencesRequest request) {
        repository.updateNotificationPreferences(request.registrationsEnabled(), request.deletionsEnabled());
        return repository.notificationPreferences();
    }

    record AdminDashboard(long registeredUsers, long savedQuotes, long tags,
                          List<AdminDailyMetric> dailyMetrics, AdminNotificationPreferences notifications,
                          LocalDate rangeStart, LocalDate rangeEnd) {}

    record NotificationPreferencesRequest(boolean registrationsEnabled, boolean deletionsEnabled) {}
}
