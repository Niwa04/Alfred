const {
  createSessionCookie,
  findMember,
  jsonResponse,
  serializeMember,
  verifyPassword
} = require('../shared/auth');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Méthode non autorisée.' }, { Allow: 'POST' });
  }

  let credentials;
  try {
    credentials = JSON.parse(event.body || '{}');
  } catch (error) {
    return jsonResponse(400, { error: 'Requête invalide.' });
  }

  let member;
  try {
    member = await findMember(String(credentials.username || ''));
  } catch (error) {
    return jsonResponse(503, { error: 'La base de données Netlify n’est pas disponible.' });
  }

  const passwordIsValid = verifyPassword(String(credentials.password || ''));

  if (!member || !passwordIsValid) {
    return jsonResponse(401, { error: 'Identifiant ou mot de passe incorrect.' });
  }

  return jsonResponse(
    200,
    { member: serializeMember(member) },
    { 'Set-Cookie': createSessionCookie(member) }
  );
};
