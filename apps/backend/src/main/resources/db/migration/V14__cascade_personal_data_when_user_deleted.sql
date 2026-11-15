ALTER TABLE tags
    DROP CONSTRAINT tags_user_id_fkey,
    ADD CONSTRAINT tags_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(uuid) ON DELETE CASCADE;

ALTER TABLE quote_selections
    DROP CONSTRAINT quote_selections_user_id_fkey,
    ADD CONSTRAINT quote_selections_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(uuid) ON DELETE CASCADE;
