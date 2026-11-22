package com.proustclub.auth.model;

import java.util.UUID;

public record OneTimeToken(long id, UUID userId) {}
