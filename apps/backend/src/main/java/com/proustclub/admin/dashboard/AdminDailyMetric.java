package com.proustclub.admin.dashboard;

import java.time.LocalDate;

public record AdminDailyMetric(LocalDate date, int registrations, int deletions) {}
