import pool from './_db.js'

const TRANSIENT_SNIPPETS = [
  'Connection terminated unexpectedly',
  'terminating connection',
  'ECONNRESET',
  'server closed the connection',
  'Connection terminated due to administrator command',
  'read ECONNRESET',
]

export async function queryWithRetry(text, values = [], attempts = 2) {
  for (let i = 1; i <= attempts; i++) {
    let client
    try {
      client = await pool.connect()
      const res = await client.query({ text, values })
      return res
    } catch (err) {
      const msg = String(err?.message || '')
      const transient = TRANSIENT_SNIPPETS.some(s => msg.includes(s))
      if (!transient || i === attempts) throw err
      // brief jittered backoff
      await new Promise(r => setTimeout(r, 150 + Math.random() * 250))
    } finally {
      if (client) client.release()
    }
  }
}
