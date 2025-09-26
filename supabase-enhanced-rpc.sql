-- Enhanced match_documents RPC function with filters and sorting
-- Bu fonksiyonu Supabase'de çalıştırarak mevcut match_documents fonksiyonunu güncelleyin

CREATE OR REPLACE FUNCTION match_documents_filtered(
  query_embedding vector(1536),
  similarity_threshold float DEFAULT 0.01,
  match_count int DEFAULT 10000,
  date_from date DEFAULT NULL,
  date_to date DEFAULT NULL,
  correspondence_type text DEFAULT NULL,
  severity_rate_filter text DEFAULT NULL,
  inc_out_filter text DEFAULT NULL,
  internal_no_filter text DEFAULT NULL,
  keywords_filter text[] DEFAULT NULL,
  sort_by text DEFAULT 'letter_date',
  sort_order text DEFAULT 'desc'
)
RETURNS TABLE (
  id bigint,
  content text,
  metadata jsonb,
  embedding vector(1536),
  internal_no text,
  letter_date date,
  type_of_corr text,
  short_desc text,
  sp_id text,
  ref_letters text,
  reply_letter text,
  severity_rate text,
  letter_no text,
  "incout" text,
  keywords text,
  weburl text,
  similarity float
)
LANGUAGE plpgsql
AS $$
DECLARE
  order_clause text;
BEGIN
  -- Build dynamic ORDER BY clause
  IF sort_by = 'similarity' THEN
    IF sort_order = 'desc' THEN
      order_clause := 'ORDER BY (d.embedding <#> query_embedding) * -1 DESC';
    ELSE
      order_clause := 'ORDER BY (d.embedding <#> query_embedding) * -1 ASC';
    END IF;
  ELSE
    IF sort_order = 'desc' THEN
      order_clause := 'ORDER BY d.' || sort_by || ' DESC NULLS LAST';
    ELSE
      order_clause := 'ORDER BY d.' || sort_by || ' ASC NULLS LAST';
    END IF;
  END IF;

  RETURN QUERY EXECUTE format('
    SELECT 
      d.id,
      d.content,
      d.metadata,
      d.embedding,
      d.internal_no,
      d.letter_date,
      d.type_of_corr,
      d.short_desc,
      d.sp_id,
      d.ref_letters,
      d.reply_letter,
      d.severity_rate,
      d.letter_no,
      d."incout",
      d.keywords,
      d.weburl,
      (d.embedding <#> $1) * -1 as similarity
    FROM documents d
    WHERE d.embedding IS NOT NULL
      AND (d.embedding <#> $1) * -1 > $2
      AND ($3 IS NULL OR d.letter_date >= $3)
      AND ($4 IS NULL OR d.letter_date <= $4)
      AND ($5 IS NULL OR d.type_of_corr = $5)
      AND ($6 IS NULL OR d.severity_rate = $6)
      AND ($7 IS NULL OR d."incout" = $7)
      AND ($8 IS NULL OR d.internal_no ILIKE ''%%'' || $8 || ''%%'')
      AND (
        $9 IS NULL 
        OR EXISTS (
          SELECT 1 FROM unnest($9) AS keyword 
          WHERE d.keywords ILIKE ''%%'' || keyword || ''%%''
        )
      )
    %s
    LIMIT $10
  ', order_clause)
  USING query_embedding, similarity_threshold, date_from, date_to, correspondence_type, 
        severity_rate_filter, inc_out_filter, internal_no_filter, keywords_filter, match_count;
END;
$$;
