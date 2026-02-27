-- ════════════════════════════════════════════════════════
-- pgvector RAG Pipeline — Database Migration
-- ════════════════════════════════════════════════════════
-- Enables the vector extension, creates the documents table
-- with HNSW index, and defines the match_documents function.
-- Dimension: 768 (Google text-embedding-004)

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create documents table
CREATE TABLE IF NOT EXISTS documents (
    id BIGSERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    embedding vector(768) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create HNSW index for cosine distance
CREATE INDEX IF NOT EXISTS documents_embedding_idx
ON documents
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 4. Create GIN index on metadata for hybrid filtering
CREATE INDEX IF NOT EXISTS documents_metadata_idx
ON documents
USING gin (metadata);

-- 5. Create match_documents function
CREATE OR REPLACE FUNCTION match_documents (
    query_embedding vector(768),
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
