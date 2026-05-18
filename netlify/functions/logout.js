const { createExpiredSessionCookie, jsonResponse } = require('../shared/auth');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Méthode non autorisée.' }, { Allow: 'POST' });
  }

  return jsonResponse(
    200,
    { success: true },
    { 'Set-Cookie': createExpiredSessionCookie() }
  );
};
