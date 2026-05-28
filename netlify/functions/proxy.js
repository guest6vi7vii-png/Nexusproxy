// netlify/functions/proxy.js
exports.handler = async (event, context) => {
  // ========== ANTI-CORS HEADERS ==========
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE, PATCH',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json'
  };

  // ========== HANDLE PREFLIGHT (OPTIONS) ==========
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // ========== AMBIL URL TARGET ==========
  const targetUrl = event.queryStringParameters && event.queryStringParameters.url;
  
  if (!targetUrl) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing url parameter. Use ?url=YOUR_TARGET_URL' })
    };
  }

  // ========== DOMAIN ALLOWLIST ==========
  const allowed = [
    'https://api.elevenlabs.io',
    'https://api.groq.com',
    'https://generativelanguage.googleapis.com',
    'https://accounts.google.com',
    'https://oauth2.googleapis.com',
    'https://www.googleapis.com',
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
    'https://google.com',
    'https://www.google.com',
    'https://api.ipify.org',
    'https://httpbin.org'
  ];

  if (!allowed.some(d => targetUrl.startsWith(d))) {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ error: 'Domain not allowed', blocked_url: targetUrl })
    };
  }

  // ========== FORWARD REQUEST ==========
  try {
    // Siapin forward headers
    const forwardHeaders = {};
    for (const [key, value] of Object.entries(event.headers)) {
      if (!['host', 'connection', 'content-length', 'origin', 'referer'].includes(key.toLowerCase())) {
        forwardHeaders[key] = value;
      }
    }

    // Tambahin user-agent palsu biar ga keliatan bot
    forwardHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    forwardHeaders['Accept'] = '*/*';
    forwardHeaders['Accept-Language'] = 'en-US,en;q=0.9,id;q=0.8';

    // Siapin body
    let body = undefined;
    if (event.body) {
      body = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body;
    }

    // Kirim request ke target
    const response = await fetch(targetUrl, {
      method: event.httpMethod,
      headers: forwardHeaders,
      body: body,
      redirect: 'follow'
    });

    // Ambil response
    const responseBuffer = await response.arrayBuffer();
    const responseBody = Buffer.from(responseBuffer).toString('base64');

    // Siapin response headers
    const responseHeaders = { ...headers };
    response.headers.forEach((value, key) => {
      if (!['transfer-encoding', 'connection', 'content-encoding'].includes(key.toLowerCase())) {
        responseHeaders[key] = value;
      }
    });

    // Kalo response HTML/text, decode biar bisa dibaca
    let finalBody = responseBody;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text') || contentType.includes('json') || contentType.includes('javascript')) {
      finalBody = Buffer.from(responseBuffer).toString('utf-8');
      responseHeaders['Content-Type'] = contentType;
      return {
        statusCode: response.status,
        headers: responseHeaders,
        body: finalBody,
        isBase64Encoded: false
      };
    }

    return {
      statusCode: response.status,
      headers: responseHeaders,
      body: responseBody,
      isBase64Encoded: true
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Proxy failed', 
        message: error.message,
        target: targetUrl
      })
    };
  }
};
