package com.proustclub.auth;

import java.util.UUID;

record EmailVerificationToken(long id, UUID userId) {}
