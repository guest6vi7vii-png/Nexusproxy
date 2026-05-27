exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
    'Access-Control-Allow-Headers': '*',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const targetUrl = event.queryStringParameters && event.queryStringParameters.url;
  if (!targetUrl) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing url parameter' }) };
  }

  const allowed = [
    'https://api.elevenlabs.io',
    'https://api.groq.com',
    'https://generativelanguage.googleapis.com',
    'https://accounts.google.com',
    'https://oauth2.googleapis.com',
    'https://www.googleapis.com',
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
  ];

  if (!allowed.some(d => targetUrl.startsWith(d))) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Domain not allowed' }) };
  }

  try {
    const forwardHeaders = {};
    for (const [key, value] of Object.entries(event.headers)) {
      if (!['host', 'connection', 'content-length'].includes(key.toLowerCase())) {
        forwardHeaders[key] = value;
      }
    }

    let body = undefined;
    if (event.body) {
      body = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body;
    }

    const response = await fetch(targetUrl, {
      method: event.httpMethod,
      headers: forwardHeaders,
      body: body,
    });

    const responseBuffer = await response.arrayBuffer();
    const responseBody = Buffer.from(responseBuffer).toString('base64');

    const responseHeaders = { ...headers };
    response.headers.forEach((value, key) => {
      if (!['transfer-encoding', 'connection'].includes(key.toLowerCase())) {
        responseHeaders[key] = value;
      }
    });

    return {
      statusCode: response.status,
      headers: responseHeaders,
      body: responseBody,
      isBase64Encoded: true,
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Proxy failed: ' + error.message }),
    };
  }
};
