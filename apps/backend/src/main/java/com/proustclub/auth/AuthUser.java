package com.proustclub.auth;

import java.util.UUID;

record AuthUser(UUID uuid, String username, String email, String passwordHash, String role) {}
