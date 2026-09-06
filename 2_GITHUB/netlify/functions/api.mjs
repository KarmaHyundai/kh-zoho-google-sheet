/**
 * Karma Hyundai Google Sheet Request Portal
 * Netlify Function - Final Production
 */

export default async (request) => {
  if (request.method !== 'POST') {
    return jsonResponse(405, {
      ok: false,
      error: 'Method not allowed.'
    });
  }

  const appsScriptUrl =
    Netlify.env.get('APPS_SCRIPT_URL');

  const apiSecret =
    Netlify.env.get('KH_GSR_API_SECRET');

  if (!appsScriptUrl || !apiSecret) {
    return jsonResponse(500, {
      ok: false,
      error:
        'Server configuration is incomplete.'
    });
  }

  try {
    const incoming = await request.json();

    const upstream = await fetch(
      appsScriptUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...incoming,
          apiSecret
        }),
        redirect: 'follow'
      }
    );

    const text = await upstream.text();

    try {
      return jsonResponse(
        200,
        JSON.parse(text)
      );

    } catch {
      console.error(
        'Apps Script returned non-JSON response',
        {
          status: upstream.status,
          contentType:
            upstream.headers.get('content-type') || '',
          preview:
            String(text || '').slice(0, 300)
        }
      );

      return jsonResponse(502, {
        ok: false,
        error:
          'The Google backend is temporarily unavailable. Please try again.'
      });
    }

  } catch (err) {
    console.error(
      'Netlify proxy failure',
      err
    );

    return jsonResponse(500, {
      ok: false,
      error:
        err && err.message
          ? err.message
          : 'Proxy request failed.'
    });
  }
};


function jsonResponse(status, body) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    }
  );
}
