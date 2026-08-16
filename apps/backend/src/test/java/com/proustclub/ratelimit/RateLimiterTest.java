package com.proustclub.ratelimit;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RateLimiterTest {

    @Test
    void allowsUpToCapacityThenRejects() {
        var limiter = newLimiter(2, Duration.ofMinutes(1));

        limiter.checkRegisterByIp(requestFrom("1.2.3.4"));
        limiter.checkRegisterByIp(requestFrom("1.2.3.4"));

        assertThatThrownBy(() -> limiter.checkRegisterByIp(requestFrom("1.2.3.4")))
                .isInstanceOf(RateLimitExceededException.class);
    }

    @Test
    void allowsAgainAfterRefill() throws InterruptedException {
        var limiter = newLimiter(1, Duration.ofMillis(200));

        limiter.checkSearchByIp(requestFrom("1.2.3.4"));
        assertThatThrownBy(() -> limiter.checkSearchByIp(requestFrom("1.2.3.4")))
                .isInstanceOf(RateLimitExceededException.class);

        Thread.sleep(300);

        limiter.checkSearchByIp(requestFrom("1.2.3.4")); // does not throw: bucket refilled
    }

    @Test
    void differentIpsHaveIndependentBuckets() {
        var limiter = newLimiter(1, Duration.ofMinutes(1));

        limiter.checkSearchByIp(requestFrom("1.1.1.1"));
        limiter.checkSearchByIp(requestFrom("2.2.2.2")); // different key, does not throw
    }

    @Test
    void loginAccountBucketIsIndependentOfLoginIpBucket() {
        var limiter = newLimiter(1, Duration.ofMinutes(1));

        limiter.checkLoginByIp(requestFrom("1.1.1.1"));
        limiter.checkLoginByAccount("marcel"); // separate bucket, does not throw
    }

    @Test
    void sameAccountFromDifferentIpsStillHitsTheAccountLimit() {
        var limiter = newLimiter(1, Duration.ofMinutes(1));

        limiter.checkLoginByAccount("marcel");

        assertThatThrownBy(() -> limiter.checkLoginByAccount("marcel"))
                .isInstanceOf(RateLimitExceededException.class);
    }

    @Test
    void unknownUsernameFollowsTheExactSameLogicAsARealOne() {
        var limiter = newLimiter(1, Duration.ofMinutes(1));

        // No special-casing: a bucket is created for whatever string is submitted, whether or
        // not it happens to be a real account — otherwise bucket existence itself would leak
        // account existence.
        limiter.checkLoginByAccount("ghost-user-that-does-not-exist");

        assertThatThrownBy(() -> limiter.checkLoginByAccount("ghost-user-that-does-not-exist"))
                .isInstanceOf(RateLimitExceededException.class);
    }

    @Test
    void passwordChangeAccountBucketIsIndependentOfLoginAccountBucket() {
        var limiter = newLimiter(1, Duration.ofMinutes(1));

        limiter.checkLoginByAccount("marcel");
        limiter.checkPasswordChangeByAccount("marcel"); // separate bucket, does not throw

        assertThatThrownBy(() -> limiter.checkPasswordChangeByAccount("marcel"))
                .isInstanceOf(RateLimitExceededException.class);
    }

    @Test
    void passwordResetConfirmIpBucketIsIndependentOfPasswordResetRequestIpBucket() {
        var limiter = newLimiter(1, Duration.ofMinutes(1));

        limiter.checkPasswordResetByIp(requestFrom("1.1.1.1"));
        limiter.checkPasswordResetConfirmByIp(requestFrom("1.1.1.1")); // separate bucket, does not throw

        assertThatThrownBy(() -> limiter.checkPasswordResetConfirmByIp(requestFrom("1.1.1.1")))
                .isInstanceOf(RateLimitExceededException.class);
    }

    @Test
    void emailVerificationResendAccountBucketIsIndependentOfPasswordChangeAccountBucket() {
        var limiter = newLimiter(1, Duration.ofMinutes(1));

        limiter.checkPasswordChangeByAccount("marcel");
        limiter.checkEmailVerificationResendByAccount("marcel"); // separate bucket, does not throw

        assertThatThrownBy(() -> limiter.checkEmailVerificationResendByAccount("marcel"))
                .isInstanceOf(RateLimitExceededException.class);
    }

    private static RateLimiter newLimiter(int capacity, Duration refillPeriod) {
        var limit = new RateLimitProperties.Limit(capacity, refillPeriod);
        var properties = new RateLimitProperties(
                new RateLimitProperties.IpAndAccountLimit(limit, limit),
                new RateLimitProperties.IpLimit(limit),
                new RateLimitProperties.IpLimit(limit),
                new RateLimitProperties.IpAndAccountLimit(limit, limit),
                new RateLimitProperties.IpLimit(limit),
                new RateLimitProperties.AccountLimit(limit),
                new RateLimitProperties.AccountLimit(limit)
        );
        return new RateLimiter(properties);
    }

    private static HttpServletRequest requestFrom(String ip) {
        var request = new MockHttpServletRequest();
        request.setRemoteAddr(ip);
        return request;
    }
}
