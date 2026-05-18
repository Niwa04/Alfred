const { getSessionMember, jsonResponse, serializeMember } = require('../shared/auth');
const { getPlanningEvents } = require('../shared/planning-store');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Méthode non autorisée.' }, { Allow: 'GET' });
  }

  let member;
  try {
    member = await getSessionMember(event);
  } catch (error) {
    return jsonResponse(503, { error: 'La base de données Netlify n’est pas disponible.' });
  }

  if (!member) {
    return jsonResponse(401, { error: 'Connexion requise.' });
  }

  try {
    return jsonResponse(200, {
      message: `Bonjour ${member.displayName}`,
      member: serializeMember(member),
      events: await getPlanningEvents(member.username)
    });
  } catch (error) {
    return jsonResponse(503, { error: 'La base de données Netlify n’est pas disponible.' });
  }
};
