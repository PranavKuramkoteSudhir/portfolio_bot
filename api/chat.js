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

// Check for obvious personal pronouns/questions
function isPotentiallyAboutPranav(query) {
  const personalIndicators = [
    'pranav', 'you', 'your', 'yourself', 'who are you', 'what is your name', 
    'tell me about yourself', 'what do you do', 'where do you work',
    'your experience', 'your skills', 'your background', 'tell me about',
    'what are you', 'how are you', 'where are you from', 'your education',
    'your projects', 'your career', 'about you'
  ];
  const lowerQuery = query.toLowerCase();
  return personalIndicators.some(indicator => lowerQuery.includes(indicator));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    console.warn('Method not allowed:', req.method)
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { query } = req.body
  if (!query) {
    console.warn('Missing query in request body')
    return res.status(400).json({ error: 'Missing query' })
  }

  console.log('Received query:', query)

  try {
    // 🔹 Step 1: Check if query is potentially about Pranav
    if (!isPotentiallyAboutPranav(query)) {
      console.log('Query not obviously about Pranav, using classification...')
      
      // Use classification as a second check
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
      });

      if (!classifyRes.ok) {
        console.error('Classification API failed, proceeding anyway...')
      } else {
        const classifyJson = await classifyRes.json();
        console.log('Classification response:', classifyJson.text?.trim());
        
        if (!classifyJson.text?.trim().toUpperCase().includes('YES')) {
          return res.json({ 
            response: "I can only answer questions about Pranav. Please ask me something about Pranav specifically." 
          });
        }
      }
    }

    // 🔹 Step 2: Embed query
    console.log('Sending request to Cohere Embed API...')
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
    console.log('Got embedding:', embedding?.slice(0, 5), '...')

    if (!embedding) {
      console.error('Embedding missing in response:', embedJson)
      return res.status(500).json({ error: 'Embedding not returned from Cohere' })
    }

    // 🔹 Step 3: Search DB and get best document
    console.log('Querying PostgreSQL...')
    const client = await pool.connect()
    const dbRes = await client.query(
      `SELECT title, content, 1 - (embedding <=> $1::vector) AS similarity
       FROM documents
       ORDER BY similarity DESC
       LIMIT 5`,
      [`[${embedding.join(',')}]`]
    )
    client.release()

    console.log('DB results count:', dbRes.rows.length)
    console.log('Top similarities:', dbRes.rows.map(row => ({
      title: row.title,
      similarity: parseFloat(row.similarity).toFixed(3)
    })))

    // Choose the best document based on similarity score
    const bestDoc = dbRes.rows[0]
    const bestSimilarity = parseFloat(bestDoc?.similarity ?? 0)
    console.log('Best document similarity:', bestSimilarity)

    // If no documents or very low similarity, provide a fallback
    let contextContent = '';
    if (!bestDoc || bestSimilarity < 0.1) {
      console.warn('No relevant documents found, using generic context')
      contextContent = 'No specific context available about this topic.';
    } else {
      contextContent = bestDoc.content;
      console.log('Using document:', bestDoc.title)
    }

    // 🔹 Step 4: Generate answer
    const prompt = `You are Pranav's AI assistant. You should ONLY answer questions about Pranav using the provided context.

If the question is about Pranav but the context doesn't contain relevant information, respond with: "I don't have specific information to answer that question about Pranav."

If the question is not about Pranav at all, respond with: "I can only answer questions about Pranav."

Context about Pranav:
${contextContent}

Question: ${query}
Answer:`

    console.log('Prompt to Cohere Chat (first 150 chars):', prompt.slice(0, 150), '...')

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
    console.log('Generation response received')

    const answer = genJson.text?.trim() || 'Failed to generate a response'
    console.log('Final answer:', answer)

    res.json({ 
      response: answer,
      debug: {
        similarity: bestSimilarity,
        documentUsed: bestDoc?.title || 'No document',
        documentsFound: dbRes.rows.length
      }
    })
  } catch (err) {
    console.error('Unexpected error:', err)
    res.status(500).json({ error: 'Something went wrong' })
  }
}
