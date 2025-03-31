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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    console.warn('⛔ Method not allowed:', req.method)
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { query } = req.body
  if (!query) {
    console.warn('⚠️ Missing query in request body')
    return res.status(400).json({ error: 'Missing query' })
  }

  console.log('📩 Received query:', query)

  try {
    // 🔹 1. Embed query
    console.log('🔗 Sending request to Cohere Embed API...')
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

    if (!embedRes.ok) {
      const errorText = await embedRes.text()
      console.error('❌ Cohere Embed API failed:', errorText)
      return res.status(500).json({ error: 'Failed to get embedding from Cohere' })
    }

    const embedJson = await embedRes.json()
    const embedding = embedJson.embeddings?.[0]
    console.log('✅ Got embedding:', embedding?.slice(0, 5), '...')

    if (!embedding) {
      console.error('❌ Embedding missing in response:', embedJson)
      return res.status(500).json({ error: 'Embedding not returned from Cohere' })
    }

    // 🔹 2. Search DB
    console.log('🗄️ Querying PostgreSQL...')
    const client = await pool.connect()
    const dbRes = await client.query(
      `SELECT title, content, 1 - (embedding <=> $1::vector) AS similarity
       FROM documents
       ORDER BY similarity DESC
       LIMIT 3`,
      [`[${embedding.join(',')}]`]
    )
    client.release()

    console.log('📦 DB results:', dbRes.rows)

    const doc = dbRes.rows[0]
    const similarity = parseFloat(doc?.similarity ?? 0)
    console.log('🔍 Top similarity score:', similarity)

    if (!doc || similarity < 0.5) {
      console.warn('⚠️ No confident match found')
      return res.json({ response: "Sorry, nothing matched confidently enough." })
    }

    // 🔹 3. Generate answer
    const prompt = `Use the context below to answer the question:\n\nContext:\n${doc.content}\n\nQuestion: ${query}\nAnswer:`
    console.log('✉️ Prompt to Cohere Chat:', prompt.slice(0, 100), '...')

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

    if (!genRes.ok) {
      const genErrorText = await genRes.text()
      console.error('❌ Cohere Gen API failed:', genErrorText)
      return res.status(500).json({ error: 'Failed to generate a response' })
    }

    const genJson = await genRes.json()
    console.log('🧠 Generation response:', genJson)

    const answer = genJson.text?.trim() || 'Failed to generate a response'
    console.log('✅ Final answer:', answer)

    res.json({ response: answer })
  } catch (err) {
    console.error('🔥 Unexpected error:', err)
    res.status(500).json({ error: 'Something went wrong' })
  }
}
