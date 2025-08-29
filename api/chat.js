import fetch from 'node-fetch'
import { queryWithRetry } from './_db-utils.js' 


const EMBED_API_KEY = process.env.COHERE_EMBED_API_KEY
const GEN_API_KEY = process.env.COHERE_GEN_API_KEY

function isPotentiallyAboutPranav(query) {
  const personalIndicators = [
    'pranav', 'you', 'your', 'yourself', 'who are you', 'what is your name',
    'tell me about yourself', 'what do you do', 'where do you work',
    'your experience', 'your skills', 'your background', 'tell me about',
    'what are you', 'how are you', 'where are you from', 'your education',
    'your projects', 'your career', 'about you'
  ]
  const s = String(query || '').toLowerCase()
  return personalIndicators.some(k => s.includes(k))
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { query } = req.body || {}
  if (!query) {
    return res.status(400).json({ error: 'Missing query' })
  }

  try {
    // --- 1) Gate: only answer questions about Pranav
    if (!isPotentiallyAboutPranav(query)) {
      try {
        const classifyRes = await fetch('https://api.cohere.ai/v1/chat', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${GEN_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'command-r',
            message: `Is this question something that could reasonably be asked to a person or their AI assistant about themselves: "${query}"? Answer only "YES" or "NO":`,
            temperature: 0.1
          })
        })

        if (classifyRes.ok) {
          const classifyJson = await classifyRes.json()
          const txt = String(classifyJson.text || '').trim().toUpperCase()
          if (!txt.includes('YES')) {
            return res.json({
              response: 'I can only answer questions about Pranav. Please ask me something about Pranav specifically.'
            })
          }
        }
      } catch {

      }
    }

    // --- 2) Embed the query (Cohere)
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
      console.error('Cohere Embed API failed:', errorText)
      return res.status(500).json({ error: 'Failed to get embedding from Cohere' })
    }

    const embedJson = await embedRes.json()
    const embedding = embedJson.embeddings?.[0]
    if (!embedding) {
      console.error('Embedding missing in response:', embedJson)
      return res.status(500).json({ error: 'Embedding not returned from Cohere' })
    }


    const vectorLiteral = `[${embedding.join(',')}]`

    const dbRes = await queryWithRetry(
      `SELECT title, content, 1 - (embedding <=> $1::vector) AS similarity
       FROM documents
       ORDER BY similarity DESC
       LIMIT 5`,
      [vectorLiteral]
    )

    const bestDoc = dbRes?.rows?.[0]
    const bestSimilarity = bestDoc ? Number(bestDoc.similarity) : 0
    const contextContent =
      bestDoc && bestSimilarity >= 0.0
        ? bestDoc.content
        : 'No specific context available about this topic.'

    // --- 4) Generate answer (Cohere)
    const prompt = `You are Pranav's AI assistant. You should ONLY answer questions about Pranav using the provided context.

If the question is about Pranav but the context doesn't contain relevant information, respond with: "I don't have specific information to answer that question about Pranav."

If the question is not about Pranav at all, respond with: "I can only answer questions about Pranav."

Context about Pranav:
${contextContent}

Question: ${query}
Answer:`

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
      console.error('Cohere Gen API failed:', genErrorText)
      return res.status(500).json({ error: 'Failed to generate a response' })
    }

    const genJson = await genRes.json()
    const answer = String(genJson.text || '').trim() || 'Failed to generate a response'

    return res.json({
      response: answer,
      debug: {
        similarity: bestSimilarity,
        documentUsed: bestDoc?.title || 'No document',
        documentsFound: dbRes?.rows?.length || 0
      }
    })
  } catch (err) {
    console.error('Unexpected error:', err)
    return res.status(500).json({ error: 'Something went wrong' })
  }
}
