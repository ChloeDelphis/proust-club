# ADR-018 — Aperçu léger de recherche pour la frise

**Statut : accepté — 2026-11-07**

## Contexte

La frise doit représenter chaque paragraphe correspondant à une recherche dans le corpus, avec les nombres de passages par tome et partie et un aperçu au survol. La recherche paginée ne renvoie qu’une page de paragraphes complets ; la réutiliser ferait perdre les marqueurs hors page ou transférerait des textes complets uniquement pour dessiner la frise. Calculer les positions et les comptes à partir des pages déjà affichées donnerait une frise incomplète.

## Décision

Ajouter `GET /api/search/overview?q=...`, indépendant des filtres et de la pagination de la liste. Il renvoie un marqueur léger par paragraphe trouvé, les comptes par tome et partie et un aperçu d’au plus cinq mots. Le backend parcourt les correspondances et ne renvoie pas le paragraphe complet. Le frontend met en cache cette réponse par requête et filtre les marqueurs localement lors du zoom.

La liste paginée reste responsable de fournir les paragraphes complets nécessaires à la lecture, à la mise en évidence et à l’enregistrement d’une citation. L’aperçu public ne contient pas de tags ni de données de citations personnelles.

## Conséquences

- La frise peut montrer la distribution complète sans dépendre de la page courante de résultats.
- Les textes complets restent limités aux résultats paginés visibles ; l’aperçu réduit la réponse de frise, mais PostgreSQL doit tout de même examiner les paragraphes candidats pour trouver les correspondances.
- L’aperçu est un nouveau contrat public et suit la même limite de requêtes par adresse IP que la recherche paginée.
- Les marqueurs restent locaux au navigateur pour les filtres de tome/partie ; si le corpus croît fortement, il faudra réévaluer le volume de marqueurs non paginés.
