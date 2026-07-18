-- Adds a dedicated field for the video-player poster / social-preview image,
-- separate from cover_url (which is the album-art style image used in the
-- song library grid/rows).
ALTER TABLE songs ADD COLUMN IF NOT EXISTS video_thumbnail_url text;
