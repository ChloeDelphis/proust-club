package com.proustclub.mail;

// Contains the rendered message only in memory until the enclosing transaction commits.
// The recipient and token-bearing body must never be logged or persisted by this event flow.
record MailDeliveryRequested(String action, String recipient, String subject, String body) {}
