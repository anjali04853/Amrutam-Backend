ALTER TABLE doctors ADD COLUMN IF NOT EXISTS search_vector_computed tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(specialty, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(bio, '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS doctors_search_vector_idx ON doctors USING GIN (search_vector_computed);
