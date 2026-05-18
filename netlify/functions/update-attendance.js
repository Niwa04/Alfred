const { getSessionMember, jsonResponse } = require('../shared/auth');
const { updatePlanningAttendance } = require('../shared/planning-store');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Methode non autorisee.' }, { Allow: 'POST' });
  }

  let member;
  try {
    member = await getSessionMember(event);
  } catch (error) {
    return jsonResponse(503, { error: 'La base de donnees Netlify n est pas disponible.' });
  }

  if (!member) {
    return jsonResponse(401, { error: 'Connexion requise.' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (error) {
    return jsonResponse(400, { error: 'Requete invalide.' });
  }

  try {
    const result = await updatePlanningAttendance(payload.eventId, member.username, payload.isPresent);
    if (result.error) {
      return jsonResponse(400, { error: result.error });
    }

    return jsonResponse(200, result);
  } catch (error) {
    return jsonResponse(503, { error: 'La base de donnees Netlify n est pas disponible.' });
  }
};
