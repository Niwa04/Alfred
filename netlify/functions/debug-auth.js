const { findMember, jsonResponse, serializeMember, verifyPassword } = require('../shared/auth');
const {
  getConfiguredConnectionString,
  getConfiguredConnectionStringKey,
  getDatabaseClient,
  normalizeDatabaseRows
} = require('../shared/database');

exports.handler = async () => {
  const username = 'Niwa';
  const password = 'Alfred2026';
  const runtimePassword = process.env.MEMBER_PASSWORD || '';
  let member = null;
  let memberError = null;
  let membersCount = null;
  let membersCountError = null;

  try {
    member = await findMember(username);
  } catch (error) {
    memberError = error.message;
  }

  try {
    const db = await getDatabaseClient();
    const result = await db.sql`SELECT COUNT(*)::int AS count FROM members`;
    membersCount = normalizeDatabaseRows(result)[0]?.count ?? null;
  } catch (error) {
    membersCountError = error.message;
  }

  return jsonResponse(200, {
    warning: 'Diagnostic temporaire: supprimer cette page apres verification.',
    netlifyContext: process.env.CONTEXT || null,
    commitRef: process.env.COMMIT_REF || null,
    deployId: process.env.DEPLOY_ID || null,
    memberPasswordEnvIsSet: Boolean(process.env.MEMBER_PASSWORD),
    memberPasswordEnvLength: runtimePassword.length,
    memberPasswordEnvTrimmedLength: runtimePassword.trim().length,
    databaseConnectionEnvKey: getConfiguredConnectionStringKey(),
    databaseConnectionEnvIsSet: Boolean(getConfiguredConnectionString()),
    databaseConnectionEnvLength: getConfiguredConnectionString().length,
    testedUsername: username,
    testedPasswordLength: password.length,
    passwordIsValid: verifyPassword(password),
    membersCount,
    membersCountError,
    memberFound: Boolean(member),
    member: member ? serializeMember(member) : null,
    memberError
  });
};
