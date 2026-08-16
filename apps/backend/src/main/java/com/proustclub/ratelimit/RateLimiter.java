package com.proustclub.ratelimit;

import com.proustclub.auth.EmailNormalizer;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.LoadingCache;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.ConsumptionProbe;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Locale;

@Component
public class RateLimiter {

    private static final Logger log = LoggerFactory.getLogger(RateLimiter.class);

    private final LoadingCache<String, Bucket> loginByIp;
    private final LoadingCache<String, Bucket> loginByAccount;
    private final LoadingCache<String, Bucket> registerByIp;
    private final LoadingCache<String, Bucket> searchByIp;
    private final LoadingCache<String, Bucket> passwordResetByIp;
    private final LoadingCache<String, Bucket> passwordResetByAccount;
    private final LoadingCache<String, Bucket> passwordResetConfirmByIp;
    private final LoadingCache<String, Bucket> passwordChangeByAccount;
    private final LoadingCache<String, Bucket> emailVerificationResendByAccount;

    RateLimiter(RateLimitProperties properties) {
        this.loginByIp = cacheFor(properties.login().perIp());
        this.loginByAccount = cacheFor(properties.login().perAccount());
        this.registerByIp = cacheFor(properties.register().perIp());
        this.searchByIp = cacheFor(properties.search().perIp());
        this.passwordResetByIp = cacheFor(properties.passwordReset().perIp());
        this.passwordResetByAccount = cacheFor(properties.passwordReset().perAccount());
        this.passwordResetConfirmByIp = cacheFor(properties.passwordResetConfirm().perIp());
        this.passwordChangeByAccount = cacheFor(properties.passwordChange().perAccount());
        this.emailVerificationResendByAccount = cacheFor(properties.emailVerificationResend().perAccount());
    }

    public void checkLoginByIp(HttpServletRequest request) {
        check(loginByIp, ClientIp.resolve(request), "login", "ip");
    }

    public void checkLoginByAccount(String username) {
        // Normalized here, not by the caller: this is the one place the account-bucket key is
        // derived, so the rule can't drift out of sync between call sites.
        check(loginByAccount, username.trim().toLowerCase(Locale.ROOT), "login", "account");
    }

    public void checkRegisterByIp(HttpServletRequest request) {
        check(registerByIp, ClientIp.resolve(request), "register", "ip");
    }

    public void checkSearchByIp(HttpServletRequest request) {
        check(searchByIp, ClientIp.resolve(request), "search", "ip");
    }

    public void checkPasswordResetByIp(HttpServletRequest request) {
        check(passwordResetByIp, ClientIp.resolve(request), "password-reset", "ip");
    }

    public void checkPasswordResetByAccount(String email) {
        check(passwordResetByAccount, EmailNormalizer.normalize(email), "password-reset", "account");
    }

    // IP only, no account bucket: the account isn't known until the token itself has been
    // resolved, same reasoning as register()'s IP-only limit. This exists specifically because
    // confirmReset() can now trigger a real outbound HIBP call (breach check) on any request
    // presenting a still-live token — previously this endpoint only ever did cheap DB work, so it
    // had no rate limit at all.
    public void checkPasswordResetConfirmByIp(HttpServletRequest request) {
        check(passwordResetConfirmByIp, ClientIp.resolve(request), "password-reset-confirm", "ip");
    }

    public void checkPasswordChangeByAccount(String username) {
        check(passwordChangeByAccount, username.trim().toLowerCase(Locale.ROOT), "password-change", "account");
    }

    public void checkEmailVerificationResendByAccount(String username) {
        check(emailVerificationResendByAccount, username.trim().toLowerCase(Locale.ROOT), "email-verification-resend", "account");
    }

    private void check(LoadingCache<String, Bucket> buckets, String key, String endpoint, String keyType) {
        ConsumptionProbe probe = buckets.get(key).tryConsumeAndReturnRemaining(1);
        if (!probe.isConsumed()) {
            log.warn("rate_limit_exceeded endpoint={} keyType={}", endpoint, keyType);
            throw new RateLimitExceededException(Duration.ofNanos(probe.getNanosToWaitForRefill()));
        }
    }

    // Bucket-per-key backed by a bounded, self-evicting cache — never an unbounded
    // ConcurrentHashMap that would itself become a memory-exhaustion vector.
    private static LoadingCache<String, Bucket> cacheFor(RateLimitProperties.Limit limit) {
        return Caffeine.newBuilder()
                .expireAfterAccess(limit.refillPeriod().multipliedBy(2))
                .maximumSize(100_000)
                .build(key -> Bucket.builder()
                        .addLimit(bandwidth -> bandwidth
                                .capacity(limit.capacity())
                                .refillGreedy(limit.capacity(), limit.refillPeriod()))
                        .build());
    }
}
