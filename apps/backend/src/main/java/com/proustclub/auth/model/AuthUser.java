package com.proustclub.auth.model;

import java.util.UUID;

public record AuthUser(UUID uuid, String username, String email, String passwordHash, String role, boolean emailVerified) {}
