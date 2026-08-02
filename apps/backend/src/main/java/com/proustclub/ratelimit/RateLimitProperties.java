package com.proustclub.ratelimit;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "rate-limit")
record RateLimitProperties(LoginLimits login, IpLimit register, IpLimit search) {

    record LoginLimits(Limit perIp, Limit perAccount) {}

    record IpLimit(Limit perIp) {}

    record Limit(int capacity, Duration refillPeriod) {}
}
