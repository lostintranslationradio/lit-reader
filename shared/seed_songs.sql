-- Run this AFTER schema.sql, once, to load the 4 existing demo/placeholder songs
-- into the new songs table. Safe to re-run — it upserts by id.

insert into songs (id, zh, en, artist, status, tags, youtube_id, context, lines)
values (
  'song-1',
  '翻译一首歌',
  'Translate a Song',
  'demo · concept',
  'published',
  '["demo", "meta"]'::jsonb,
  '',
  'This is the demo song, so there''s nothing to explain culturally — but this is exactly where you''d put it. For a real song, this box is where background goes: a poem it references, the story behind a lyric, or why you translated a line the way you did.',
  '[{"words": [{"h": "音乐", "p": "yīnyuè", "g": ["music"], "hsk": 3}, {"h": "没有", "p": "méiyǒu", "g": ["doesn''t have"], "hsk": 1}, {"h": "国界", "p": "guójiè", "g": ["borders"], "hsk": 5}, {"h": "。", "p": "", "g": [], "hsk": 0}], "translation": "Music knows no borders,"}, {"words": [{"h": "但是", "p": "dànshì", "g": ["but"], "hsk": 2}, {"h": "歌词", "p": "gēcí", "g": ["lyrics"], "hsk": 5}, {"h": "需要", "p": "xūyào", "g": ["need"], "hsk": 3}, {"h": "翻译", "p": "fānyì", "g": ["translation"], "hsk": 4}, {"h": "。", "p": "", "g": [], "hsk": 0}], "translation": "but the words still need someone to carry them across."}, {"words": [{"h": "每", "p": "měi", "g": ["every"], "hsk": 2}, {"h": "一个", "p": "yí gè", "g": ["single"], "hsk": 1}, {"h": "字", "p": "zì", "g": ["word"], "hsk": 1}, {"h": "都", "p": "dōu", "g": ["all"], "hsk": 1}, {"h": "有", "p": "yǒu", "g": ["have"], "hsk": 1}, {"h": "意思", "p": "yìsi", "g": ["meaning"], "hsk": 2}, {"h": "。", "p": "", "g": [], "hsk": 0}], "translation": "Every single word is carrying something."}, {"words": [{"h": "长按", "p": "cháng àn", "g": ["long-press"], "hsk": 0}, {"h": "生词", "p": "shēngcí", "g": ["new word"], "hsk": 4}, {"h": "来", "p": "lái", "g": ["to"], "hsk": 1}, {"h": "收藏", "p": "shōucáng", "g": ["save"], "hsk": 5}, {"h": "。", "p": "", "g": [], "hsk": 0}], "translation": "Hold down what you don''t know yet, and keep it."}, {"words": [{"h": "你的", "p": "nǐ de", "g": ["your"], "hsk": 1}, {"h": "生词本", "p": "shēngcíběn", "g": ["vocab list"], "hsk": 0}, {"h": "会", "p": "huì", "g": ["will"], "hsk": 1}, {"h": "越来越", "p": "yuè lái yuè", "g": ["more and more"], "hsk": 3}, {"h": "多", "p": "duō", "g": ["grow"], "hsk": 1}, {"h": "。", "p": "", "g": [], "hsk": 0}], "translation": "Little by little, the list grows with you."}]'::jsonb
)
on conflict (id) do update set
  zh = excluded.zh, en = excluded.en, artist = excluded.artist, status = excluded.status,
  tags = excluded.tags, youtube_id = excluded.youtube_id, context = excluded.context, lines = excluded.lines;

insert into songs (id, zh, en, artist, status, tags, youtube_id, context, lines)
values (
  'song-2',
  '歌曲二',
  'Song Two',
  'your artist here',
  'draft',
  '["placeholder"]'::jsonb,
  '',
  'Replace this with context for the real song — e.g. for 红豆, you''d note that the title references Wang Wei''s Tang-dynasty poem 相思, where red beans (红豆) symbolize longing for someone far away.',
  '[{"words": [{"h": "这", "p": "zhè", "g": ["this"], "hsk": 1}, {"h": "是", "p": "shì", "g": ["is"], "hsk": 1}, {"h": "占位", "p": "zhànwèi", "g": ["placeholder"], "hsk": 0}, {"h": "歌词", "p": "gēcí", "g": ["lyrics"], "hsk": 5}, {"h": "。", "p": "", "g": [], "hsk": 0}], "translation": "This is placeholder lyric text —"}, {"words": [{"h": "换成", "p": "huànchéng", "g": ["swap in"], "hsk": 0}, {"h": "你的", "p": "nǐ de", "g": ["your"], "hsk": 1}, {"h": "翻译", "p": "fānyì", "g": ["translation"], "hsk": 4}, {"h": "。", "p": "", "g": [], "hsk": 0}], "translation": "swap in your real translation here."}]'::jsonb
)
on conflict (id) do update set
  zh = excluded.zh, en = excluded.en, artist = excluded.artist, status = excluded.status,
  tags = excluded.tags, youtube_id = excluded.youtube_id, context = excluded.context, lines = excluded.lines;

insert into songs (id, zh, en, artist, status, tags, youtube_id, context, lines)
values (
  'song-3',
  '歌曲三',
  'Song Three',
  'your artist here',
  'draft',
  '["placeholder"]'::jsonb,
  '',
  'Add background here: historical or literary references, the story behind the lyrics, or notes on translation choices you made.',
  '[{"words": [{"h": "这", "p": "zhè", "g": ["this"], "hsk": 1}, {"h": "是", "p": "shì", "g": ["is"], "hsk": 1}, {"h": "占位", "p": "zhànwèi", "g": ["placeholder"], "hsk": 0}, {"h": "歌词", "p": "gēcí", "g": ["lyrics"], "hsk": 5}, {"h": "。", "p": "", "g": [], "hsk": 0}], "translation": "This is placeholder lyric text —"}, {"words": [{"h": "换成", "p": "huànchéng", "g": ["swap in"], "hsk": 0}, {"h": "你的", "p": "nǐ de", "g": ["your"], "hsk": 1}, {"h": "翻译", "p": "fānyì", "g": ["translation"], "hsk": 4}, {"h": "。", "p": "", "g": [], "hsk": 0}], "translation": "swap in your real translation here."}]'::jsonb
)
on conflict (id) do update set
  zh = excluded.zh, en = excluded.en, artist = excluded.artist, status = excluded.status,
  tags = excluded.tags, youtube_id = excluded.youtube_id, context = excluded.context, lines = excluded.lines;

insert into songs (id, zh, en, artist, status, tags, youtube_id, context, lines)
values (
  'song-4',
  '歌曲四',
  'Song Four',
  'your artist here',
  'draft',
  '["placeholder"]'::jsonb,
  '',
  'Add background here: historical or literary references, the story behind the lyrics, or notes on translation choices you made.',
  '[{"words": [{"h": "这", "p": "zhè", "g": ["this"], "hsk": 1}, {"h": "是", "p": "shì", "g": ["is"], "hsk": 1}, {"h": "占位", "p": "zhànwèi", "g": ["placeholder"], "hsk": 0}, {"h": "歌词", "p": "gēcí", "g": ["lyrics"], "hsk": 5}, {"h": "。", "p": "", "g": [], "hsk": 0}], "translation": "This is placeholder lyric text —"}, {"words": [{"h": "换成", "p": "huànchéng", "g": ["swap in"], "hsk": 0}, {"h": "你的", "p": "nǐ de", "g": ["your"], "hsk": 1}, {"h": "翻译", "p": "fānyì", "g": ["translation"], "hsk": 4}, {"h": "。", "p": "", "g": [], "hsk": 0}], "translation": "swap in your real translation here."}]'::jsonb
)
on conflict (id) do update set
  zh = excluded.zh, en = excluded.en, artist = excluded.artist, status = excluded.status,
  tags = excluded.tags, youtube_id = excluded.youtube_id, context = excluded.context, lines = excluded.lines;
