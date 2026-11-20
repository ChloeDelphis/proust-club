package com.proustclub.auth;

import com.proustclub.admin.AdminDataRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
class AccountDeletionService {

    private final UserRepository userRepository;
    private final AdminDataRepository adminDataRepository;

    AccountDeletionService(UserRepository userRepository, AdminDataRepository adminDataRepository) {
        this.userRepository = userRepository;
        this.adminDataRepository = adminDataRepository;
    }

    @Transactional
    void deleteAccount(UUID userId) {
        adminDataRepository.recordDeletion(userId);
        if (userRepository.deleteByUuid(userId) != 1) {
            throw ApiException.invalidCredentials();
        }
    }
}
