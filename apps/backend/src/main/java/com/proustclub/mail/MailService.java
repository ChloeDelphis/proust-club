package com.proustclub.mail;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class MailService {

    private static final Logger log = LoggerFactory.getLogger(MailService.class);

    private final JavaMailSender mailSender;
    private final String frontendBaseUrl;

    MailService(JavaMailSender mailSender, @Value("${app.frontend-base-url}") String frontendBaseUrl) {
        this.mailSender = mailSender;
        this.frontendBaseUrl = frontendBaseUrl;
    }

    public void sendPasswordResetEmail(String to, String token) {
        var message = new SimpleMailMessage();
        message.setTo(to);
        message.setSubject("Réinitialisation de votre mot de passe — Proust Club");
        message.setText(
                "Vous avez demandé la réinitialisation de votre mot de passe.\n\n"
                        + "Cliquez sur ce lien pour choisir un nouveau mot de passe (valable 30 minutes) :\n"
                        + frontendBaseUrl + "/reset-password?token=" + token + "\n\n"
                        + "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email."
        );
        mailSender.send(message);
        log.info("Password reset email sent");
    }

    public void sendEmailConfirmation(String to, String token) {
        var message = new SimpleMailMessage();
        message.setTo(to);
        message.setSubject("Confirmez votre adresse email — Proust Club");
        message.setText(
                "Bienvenue sur Proust Club !\n\n"
                        + "Cliquez sur ce lien pour confirmer votre adresse email (valable 24h) :\n"
                        + frontendBaseUrl + "/confirm-email?token=" + token + "\n\n"
                        + "Si vous n'êtes pas à l'origine de cette inscription, ignorez cet email."
        );
        mailSender.send(message);
        log.info("Email confirmation sent");
    }
}
