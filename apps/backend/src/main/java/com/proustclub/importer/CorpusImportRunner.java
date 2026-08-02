package com.proustclub.importer;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.nio.file.Path;

@Component
@Profile("import")
public class CorpusImportRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(CorpusImportRunner.class);

    private final ParagraphParser parser;
    private final CorpusImportService importService;

    @Value("${corpus.path}")
    private String corpusPath;

    public CorpusImportRunner(ParagraphParser parser, CorpusImportService importService) {
        this.parser = parser;
        this.importService = importService;
    }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        log.info("=== Import du corpus Proust ===");

        if (importService.isAlreadyImported()) {
            log.warn("La table paragraphs n'est pas vide. Import annulé pour éviter les doublons.");
            log.warn("Pour ré-importer, videz la table manuellement : TRUNCATE paragraphs RESTART IDENTITY;");
            return;
        }

        var filePath = Path.of(corpusPath);
        log.info("Corpus : {}", filePath.toAbsolutePath());

        var paragraphs = parser.parse(filePath);
        log.info("{} paragraphes parsés", paragraphs.size());

        importService.importParagraphs(paragraphs);
        log.info("=== Import terminé avec succès ===");
    }
}
