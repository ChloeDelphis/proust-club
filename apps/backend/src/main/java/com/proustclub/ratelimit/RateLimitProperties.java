package com.proustclub.ratelimit;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "rate-limit")
record RateLimitProperties(
        IpAndAccountLimit login, IpLimit register, IpLimit search,
        IpAndAccountLimit passwordReset, IpLimit passwordResetConfirm,
        AccountLimit passwordChange, AccountLimit emailVerificationResend
) {

    record IpAndAccountLimit(Limit perIp, Limit perAccount) {}

    record IpLimit(Limit perIp) {}

    // No per-IP bucket: unlike login/register/passwordReset, this endpoint already requires an
    // authenticated session, so the account is the only meaningful key — an anonymous IP-based
    // bucket would add nothing a session cookie doesn't already gate.
    record AccountLimit(Limit perAccount) {}

    record Limit(int capacity, Duration refillPeriod) {}
}
