exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const { hanzi, pinyin, rate } = body;
  if (!hanzi) {
    return { statusCode: 400, body: 'Missing hanzi' };
  }

  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'GOOGLE_TTS_API_KEY not configured' })
    };
  }

  // If we have pinyin (numbered-tone format, e.g. "bu2"), force that exact
  // pronunciation via SSML. Otherwise just let Google's own voice decide,
  // same as the browser fallback would.
  const escapedHanzi = hanzi.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const ssml = pinyin
    ? `<speak><phoneme alphabet="pinyin" ph="${pinyin}">${escapedHanzi}</phoneme></speak>`
    : `<speak>${escapedHanzi}</speak>`;

  const requestBody = {
    input: { ssml },
    voice: { languageCode: 'cmn-CN', ssmlGender: 'FEMALE' },
    audioConfig: { audioEncoding: 'MP3', speakingRate: rate || 1.0 }
  };

  try {
    const res = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }
    );
    const data = await res.json();
    if (!data.audioContent) {
      return {
        statusCode: 502,
        body: JSON.stringify({ error: 'TTS failed', detail: data })
      };
    }
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioContent: data.audioContent })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
