/**
 * Netlify Function
 *
 * Browser -> this function -> Apps Script.
 *
 * The Apps Script API secret is never exposed to browser JavaScript
 * or committed to GitHub.
 *
 * Netlify Environment Variables required:
 *   APPS_SCRIPT_URL
 *   KH_GSR_API_SECRET
 */

export default async (request) => {

  if (request.method !== 'POST') {
    return response(
      405,
      {
        ok: false,
        error: 'Method not allowed.'
      }
    );
  }

  const appsScriptUrl =
    process.env.APPS_SCRIPT_URL;

  const apiSecret =
    process.env.KH_GSR_API_SECRET;

  if (
    !appsScriptUrl ||
    !apiSecret
  ) {
    return response(
      500,
      {
        ok: false,
        error:
          'Netlify server configuration is incomplete.'
      }
    );
  }

  try {
    const incoming =
      await request.json();

    const payload = {
      ...incoming,
      apiSecret
    };

    const upstream =
      await fetch(
        appsScriptUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json'
          },
          body:
            JSON.stringify(
              payload
            ),
          redirect: 'follow'
        }
      );

    const text =
      await upstream.text();

    let result;

    try {
      result =
        JSON.parse(text);
    } catch {
      return response(
        502,
        {
          ok: false,
          error:
            'The Google backend returned an invalid response.'
        }
      );
    }

    return response(
      200,
      result
    );

  } catch (err) {

    return response(
      500,
      {
        ok: false,
        error:
          err &&
          err.message
            ? err.message
            : 'Proxy request failed.'
      }
    );
  }
};


function response(
  status,
  body
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        'Content-Type':
          'application/json',
        'Cache-Control':
          'no-store'
      }
    }
  );
}
