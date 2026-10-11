/**
 * This file is generated. Do not edit manually.
 * Run `pnpm generate:api` to regenerate it.
 */

export const validationConstraints = {
  "CreateTagRequest": {
    "name": {
      "maxLength": 50
    }
  },
  "CreateQuoteSelectionRequest": {
    "selectedText": {
      "minLength": 1
    }
  },
  "AddTagRequest": {
    "name": {
      "maxLength": 50
    }
  },
  "RegisterRequest": {
    "username": {
      "minLength": 3,
      "maxLength": 50
    },
    "email": {
      "maxLength": 255
    },
    "password": {
      "minLength": 15,
      "maxLength": 128
    }
  },
  "PasswordChangeRequest": {
    "currentPassword": {
      "minLength": 1
    },
    "newPassword": {
      "minLength": 15,
      "maxLength": 128
    }
  },
  "PasswordResetRequestRequest": {
    "email": {
      "maxLength": 255
    }
  },
  "PasswordResetConfirmRequest": {
    "token": {
      "maxLength": 200
    },
    "newPassword": {
      "minLength": 15,
      "maxLength": 128
    }
  },
  "LoginRequest": {
    "email": {
      "maxLength": 255
    },
    "password": {
      "minLength": 1
    }
  },
  "EmailVerificationConfirmRequest": {
    "token": {
      "maxLength": 200
    }
  },
  "RenameTagRequest": {
    "name": {
      "maxLength": 50
    }
  },
  "UpdateQuoteCommentRequest": {
    "comment": {
      "maxLength": 2000
    }
  },
  "search": {
    "q": {
      "minLength": 2,
      "maxLength": 500
    }
  }
} as const
