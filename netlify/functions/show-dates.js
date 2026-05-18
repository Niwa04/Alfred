const { jsonResponse } = require('../shared/auth');
const { getShowDates } = require('../shared/show-dates-store');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Methode non autorisee.' }, { Allow: 'GET' });
  }

  try {
    return jsonResponse(200, {
      dates: await getShowDates()
    });
  } catch (error) {
    return jsonResponse(503, { error: 'La base de donnees Netlify n est pas disponible.' });
  }
};
