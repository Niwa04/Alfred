let databaseClient;

function getConfiguredConnectionString() {
  return (
    process.env.NETLIFY_DATABASE_CONNECTION_STRING ||
    process.env.DATABASE_URL ||
    process.env.NETLIFY_DATABASE_URL ||
    process.env.POSTGRES_URL ||
    ''
  ).trim();
}

function getConfiguredConnectionStringKey() {
  if (process.env.NETLIFY_DATABASE_CONNECTION_STRING) return 'NETLIFY_DATABASE_CONNECTION_STRING';
  if (process.env.DATABASE_URL) return 'DATABASE_URL';
  if (process.env.NETLIFY_DATABASE_URL) return 'NETLIFY_DATABASE_URL';
  if (process.env.POSTGRES_URL) return 'POSTGRES_URL';
  return null;
}

async function getDatabaseClient() {
  if (!databaseClient) {
    const { getDatabase } = await import('@netlify/database');
    const connectionString = getConfiguredConnectionString();
    databaseClient = connectionString ? getDatabase({ connectionString }) : getDatabase();
  }

  return databaseClient;
}

function normalizeDatabaseRows(result) {
  if (Array.isArray(result)) {
    return result;
  }

  if (Array.isArray(result?.rows)) {
    return result.rows;
  }

  return [];
}

module.exports = {
  getConfiguredConnectionString,
  getConfiguredConnectionStringKey,
  getDatabaseClient,
  normalizeDatabaseRows
};
