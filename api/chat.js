// api/chat.js

import fetch from 'node-fetch'
import pkg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const { Pool } = pkg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

const EMBED_API_KEY = process.env.COHERE_EMBED_API_KEY
const GEN_API_KEY = process.env.COHERE_GEN_API_KEY

console.log("COHERE_EMBED_API_KEY:", process.env.COHERE_EMBED_API_KEY);
console.log("DATABASE_URL:", process.env.DATABASE_URL);



export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { query } = req.body
  if (!query) return res.status(400).json({ error: 'Missing query' })

  try {
    const embedRes = await fetch('https://api.cohere.ai/v1/embed', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${EMBED_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        texts: [query],
        model: 'embed-english-v3.0',
        input_type: 'search_query'
      })
    })

    const embedJson = await embedRes.json()
    const embedding = embedJson.embeddings?.[0]

    if (!embedding) {
      return res.status(500).json({ error: 'Failed to get embedding from Cohere' })
    }

    const client = await pool.connect()
    const dbRes = await client.query(
      `SELECT title, content, 1 - (embedding <=> $1::vector) AS similarity
       FROM documents
       ORDER BY similarity DESC
       LIMIT 3`,
      [`[${embedding.join(',')}]`]
    )
    client.release()

    const doc = dbRes.rows[0]
    const similarity = parseFloat(doc?.similarity ?? 0)

    if (!doc || similarity < 0.5) {
      return res.json({ response: "Sorry, nothing matched confidently enough." })
    }

    const prompt = `Use the context below to answer the question:\n\nContext:\n${doc.content}\n\nQuestion: ${query}\nAnswer:`

    const genRes = await fetch('https://api.cohere.ai/v1/chat', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GEN_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'command-r',
        message: prompt,
        temperature: 0.5
      })
    })

    const genJson = await genRes.json()
    const answer = genJson.text?.trim() || 'Failed to generate a response'

    res.json({ response: answer })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Something went wrong' })
  }
}
