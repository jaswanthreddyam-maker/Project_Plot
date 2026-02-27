-- Fix: HNSW index has 2000-dim limit for vector type.
-- gemini-embedding-001 outputs 3072 dims.
-- Use halfvec(3072) which supports up to 4000 dims with HNSW.

DROP FUNCTION IF EXISTS match_documents;
DROP INDEX IF EXISTS documents_embedding_idx;
DROP INDEX IF EXISTS documents_metadata_idx;
DROP TABLE IF EXISTS documents;

CREATE TABLE documents (
    id BIGSERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    embedding halfvec(3072) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX documents_embedding_idx
ON documents
USING hnsw (embedding halfvec_cosine_ops)
WITH (m = 16, ef_construction = 64);

CREATE INDEX documents_metadata_idx
ON documents
USING gin (metadata);

CREATE OR REPLACE FUNCTION match_documents (
    query_embedding halfvec(3072),
    match_threshold float,
    match_count int,
    filter_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
    id bigint,
    content text,
    metadata jsonb,
    similarity float
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        documents.id,
        documents.content,
        documents.metadata,
        (1 - (documents.embedding <=> query_embedding))::float AS similarity
    FROM documents
    WHERE documents.metadata @> filter_metadata
        AND 1 - (documents.embedding <=> query_embedding) > match_threshold
    ORDER BY documents.embedding <=> query_embedding ASC
    LIMIT match_count;
END;
$$;
