const { getPlanningEvents } = require('../shared/planning-store');
const { getSessionMember, jsonResponse, serializeMember } = require('../shared/auth');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Méthode non autorisée.' }, { Allow: 'GET' });
  }

  const member = getSessionMember(event);
  if (!member) {
    return jsonResponse(401, { error: 'Connexion requise.' });
  }

  const events = await getPlanningEvents();

  return jsonResponse(200, {
    message: `Bonjour ${member.displayName}`,
    member: serializeMember(member),
    events
  });
};
