-- V2 seeded the first three volume titles in Title Case (every word capitalized). French title
-- casing only capitalizes the first word and proper nouns — correcting to match how these titles
-- are actually published (e.g. Gallimard/Folio editions). The other four volumes already followed
-- this convention ("Sodome et Gomorrhe", "La Prisonnière", "Albertine disparue", "Le Temps retrouvé").

UPDATE volumes SET title = 'Du côté de chez Swann' WHERE id = 1;
UPDATE volumes SET title = 'À l''ombre des jeunes filles en fleurs' WHERE id = 2;
UPDATE volumes SET title = 'Le côté de Guermantes' WHERE id = 3;
