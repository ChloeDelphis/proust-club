package com.proustclub.admin;

import java.time.LocalDate;

public record AdminDailyMetric(LocalDate date, int registrations, int deletions) {}
