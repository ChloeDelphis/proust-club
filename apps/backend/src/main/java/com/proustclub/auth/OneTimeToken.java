package com.proustclub.auth;

import java.util.UUID;

record OneTimeToken(long id, UUID userId) {}
