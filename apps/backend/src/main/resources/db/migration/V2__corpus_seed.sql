-- Données de référence : 7 volumes et 25 parties
-- start_page = première page de cette partie dans le fichier texte source
-- L'importeur assigne chaque paragraphe via :
--   SELECT id FROM parts WHERE start_page <= :page ORDER BY start_page DESC LIMIT 1

INSERT INTO volumes (id, title, position) VALUES
(1, 'Du Côté de Chez Swann',                   1),
(2, 'À l''Ombre des Jeunes Filles en Fleurs',  2),
(3, 'Le Côté de Guermantes',                    3),
(4, 'Sodome et Gomorrhe',                       4),
(5, 'La Prisonnière',                           5),
(6, 'Albertine disparue',                       6),
(7, 'Le Temps retrouvé',                        7);

-- Note : 1.1.2 Combray II (page 10) est fusionné dans la partie Combray (page 1)
INSERT INTO parts (id, volume_id, title, position, start_page) VALUES
-- Volume 1
(1,  1, 'Combray',                                    1,   1),
(2,  1, 'Un amour de Swann',                          2,  44),
(3,  1, 'Noms de pays : le nom',                      3,  96),
-- Volume 2
(4,  2, 'Autour de Mme Swann',                        1, 104),
(5,  2, 'Noms de pays : le pays',                     2, 140),
-- Volume 3
(6,  3, 'Le Côté de Guermantes I',                    1, 184),
(7,  3, 'Le Côté de Guermantes II — 1',               2, 230),
(8,  3, 'Le Côté de Guermantes II — 2',               3, 235),
-- Volume 4
(9,  4, 'Sodome et Gomorrhe I',                       1, 267),
(10, 4, 'Sodome et Gomorrhe II — 1',                  2, 272),
(11, 4, 'Les Intermittences du cœur',                 3, 287),
(12, 4, 'Sodome et Gomorrhe II — 2',                  4, 291),
(13, 4, 'Sodome et Gomorrhe II — 3',                  5, 316),
(14, 4, 'Sodome et Gomorrhe II — 4',                  6, 333),
-- Volume 5
(15, 5, 'La Prisonnière — 1',                         1, 336),
(16, 5, 'La Prisonnière — 2',                         2, 362),
(17, 5, 'La Prisonnière — 3',                         3, 380),
-- Volume 6
(18, 6, 'Albertine disparue — 1',                     1, 392),
(19, 6, 'Mademoiselle de Forcheville',                2, 413),
(20, 6, 'Séjour à Venise',                            3, 422),
(21, 6, 'Nouvel aspect de Robert de Saint-Loup',      4, 427),
-- Volume 7
(22, 7, 'Le Temps retrouvé — 1',                      1, 434),
(23, 7, 'M. de Charlus pendant la guerre',            2, 438),
(24, 7, 'Matinée chez la princesse de Guermantes',    3, 457),
(25, 7, 'Le Bal de têtes',                            4, 467);
