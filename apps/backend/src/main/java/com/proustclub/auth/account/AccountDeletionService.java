package com.proustclub.auth.account;

import com.proustclub.auth.ApiException;
import com.proustclub.auth.repository.UserRepository;
import com.proustclub.admin.AdminDataRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class AccountDeletionService {

    private final UserRepository userRepository;
    private final AdminDataRepository adminDataRepository;

    public AccountDeletionService(UserRepository userRepository, AdminDataRepository adminDataRepository) {
        this.userRepository = userRepository;
        this.adminDataRepository = adminDataRepository;
    }

    @Transactional
    public void deleteAccount(UUID userId) {
        adminDataRepository.recordDeletion(userId);
        if (userRepository.deleteByUuid(userId) != 1) {
            throw ApiException.invalidCredentials();
        }
    }
}
