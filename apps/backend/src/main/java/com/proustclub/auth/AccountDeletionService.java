package com.proustclub.auth;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
class AccountDeletionService {

    private final UserRepository userRepository;

    AccountDeletionService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Transactional
    void deleteAccount(UUID userId) {
        if (userRepository.deleteByUuid(userId) != 1) {
            throw ApiException.invalidCredentials();
        }
    }
}
