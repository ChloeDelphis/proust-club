package com.proustclub.mail;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

@Service
public class MailService {

    private final ApplicationEventPublisher eventPublisher;
    private final String frontendBaseUrl;

    MailService(ApplicationEventPublisher eventPublisher, @Value("${app.frontend-base-url}") String frontendBaseUrl) {
        this.eventPublisher = eventPublisher;
        this.frontendBaseUrl = frontendBaseUrl;
    }

    public void sendPasswordResetEmail(String to, String token) {
        publish("password reset email", to,
                "Réinitialisation de votre mot de passe — Proust Club",
                "Vous avez demandé la réinitialisation de votre mot de passe.\n\n"
                        + "Cliquez sur ce lien pour choisir un nouveau mot de passe (valable 30 minutes) :\n"
                        + frontendBaseUrl + "/reset-password?token=" + token + "\n\n"
                        + "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.");
    }

    public void sendEmailConfirmation(String to, String token) {
        publish("email confirmation", to,
                "Confirmez votre adresse email — Proust Club",
                "Bienvenue sur Proust Club !\n\n"
                        + "Cliquez sur ce lien pour confirmer votre adresse email (valable 24h) :\n"
                        + frontendBaseUrl + "/confirm-email?token=" + token + "\n\n"
                        + "Si vous n'êtes pas à l'origine de cette inscription, ignorez cet email.");
    }

    private void publish(String action, String to, String subject, String body) {
        eventPublisher.publishEvent(new MailDeliveryRequested(action, to, subject, body));
    }
}
