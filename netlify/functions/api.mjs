/**
 * Karma Hyundai Google Sheet Request
 * Netlify serverless proxy
 *
 * Required environment variables:
 * APPS_SCRIPT_URL
 * KH_GSR_API_SECRET
 */

export default async (request) => {
  if (request.method !== 'POST') {
    return jsonResponse(
      405,
      {
        ok: false,
        error: 'Method not allowed.'
      }
    );
  }

  const appsScriptUrl =
    Netlify.env.get(
      'APPS_SCRIPT_URL'
    );

  const apiSecret =
    Netlify.env.get(
      'KH_GSR_API_SECRET'
    );

  if (
    !appsScriptUrl ||
    !apiSecret
  ) {
    return jsonResponse(
      500,
      {
        ok: false,
        error:
          'Server configuration is incomplete.'
      }
    );
  }

  try {
    const incoming =
      await request.json();

    const result =
      await callAppsScript(
        appsScriptUrl,
        {
          ...incoming,
          apiSecret
        }
      );

    if (result.ok) {
      return jsonResponse(
        200,
        result.data
      );
    }

    return jsonResponse(
      502,
      {
        ok: false,
        error:
          'Google Apps Script deployment is not responding correctly. ' +
          'Redeploy the existing Web App as operations@karmahyundai.com ' +
          'with access set to Anyone.'
      }
    );

  } catch (err) {
    console.error(
      'Netlify proxy error',
      err
    );

    return jsonResponse(
      500,
      {
        ok: false,
        error:
          err && err.message
            ? err.message
            : 'Proxy request failed.'
      }
    );
  }
};


async function callAppsScript(
  url,
  payload
) {
  for (
    let attempt = 1;
    attempt <= 2;
    attempt++
  ) {
    const response =
      await fetch(
        url,
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
          redirect:
            'follow'
        }
      );

    const text =
      await response.text();

    try {
      return {
        ok: true,
        data:
          JSON.parse(text)
      };

    } catch {
      console.error(
        'Apps Script non-JSON response',
        {
          attempt,
          status:
            response.status,
          contentType:
            response.headers
              .get(
                'content-type'
              ) || '',
          preview:
            String(
              text || ''
            )
              .slice(
                0,
                250
              )
        }
      );

      if (attempt < 2) {
        await new Promise(
          resolve =>
            setTimeout(
              resolve,
              400
            )
        );
      }
    }
  }

  return {
    ok: false
  };
}


function jsonResponse(
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
