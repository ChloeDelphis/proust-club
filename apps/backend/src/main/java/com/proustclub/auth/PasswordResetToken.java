package com.proustclub.auth;

import java.util.UUID;

record PasswordResetToken(long id, UUID userId) {}
