// This runs on Netlify's server, not in the visitor's browser — so it can
// safely use the reCAPTCHA Secret Key without ever exposing it publicly.
// It double-checks the checkbox result directly with Google before we
// trust it, which is the missing piece that makes reCAPTCHA actually
// secure instead of just a visual deterrent.

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const token = body.token;

    if (!token) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Missing token' }) };
    }

    const secretKey = process.env.RECAPTCHA_SECRET_KEY;

    const params = new URLSearchParams();
    params.append('secret', secretKey);
    params.append('response', token);

    const verifyResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    const data = await verifyResponse.json();

    return {
      statusCode: 200,
      body: JSON.stringify({ success: data.success === true })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: 'Server error' })
    };
  }
};
