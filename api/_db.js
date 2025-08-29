import pkg from 'pg'
const { Pool } = pkg

const pool =
  globalThis._pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL, 
    max: 3,                       
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    keepAlive: true,
    ssl: { require: true, rejectUnauthorized: false },
    statement_timeout: 5_000,     
    application_name: 'vercel-app',
  })

if (!globalThis._pgPool) globalThis._pgPool = pool

export default pool
