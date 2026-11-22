package com.proustclub.admin.provisioning;

import java.util.List;

public record AdminSetupDetails(String email, String provisioningUri, List<String> recoveryCodes) {}
