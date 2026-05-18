const { getSessionMember, jsonResponse, serializeMember } = require('../shared/auth');

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
    return jsonResponse(401, { authenticated: false });
  }

  return jsonResponse(200, {
    authenticated: true,
    member: serializeMember(member)
  });
};
