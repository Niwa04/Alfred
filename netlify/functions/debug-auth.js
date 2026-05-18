const { findMember, jsonResponse, serializeMember, verifyPassword } = require('../shared/auth');

exports.handler = async () => {
  const username = 'Niwa';
  const password = 'Alfred2026';
  const runtimePassword = process.env.MEMBER_PASSWORD || '';
  let member = null;
  let memberError = null;

  try {
    member = await findMember(username);
  } catch (error) {
    memberError = error.message;
  }

  return jsonResponse(200, {
    warning: 'Diagnostic temporaire: supprimer cette page apres verification.',
    netlifyContext: process.env.CONTEXT || null,
    commitRef: process.env.COMMIT_REF || null,
    deployId: process.env.DEPLOY_ID || null,
    memberPasswordEnvIsSet: Boolean(process.env.MEMBER_PASSWORD),
    memberPasswordEnvLength: runtimePassword.length,
    memberPasswordEnvTrimmedLength: runtimePassword.trim().length,
    testedUsername: username,
    testedPasswordLength: password.length,
    passwordIsValid: verifyPassword(password),
    memberFound: Boolean(member),
    member: member ? serializeMember(member) : null,
    memberError
  });
};
