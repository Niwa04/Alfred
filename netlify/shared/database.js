let databaseClient;

async function getDatabaseClient() {
  if (!databaseClient) {
    const { getDatabase } = await import('@netlify/database');
    databaseClient = getDatabase();
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
  getDatabaseClient,
  normalizeDatabaseRows
};
