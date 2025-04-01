import { useState } from 'react'

export default function App() {
  const [query, setQuery] = useState('')
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setResponse('')

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      })      

      const data = await res.json()
      setResponse(data.response || 'No response')
    } catch (err) {
      console.error(err)
      setResponse('Something went wrong')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">

      <img
        src="/profile-pic.png"
        alt="Pranav K Sudhir"
        className="w-32 h-32 rounded-full shadow-md mb-4 object-cover"
      />

      <h1 className="text-3xl font-bold mb-4">Pranav K Sudhir</h1>

      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
      <input
        type="text"
        className="w-full p-2 border border-white bg-black text-white rounded-lg shadow-sm"
        placeholder="What would you like to know..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
        <button
          type="submit"
          className="w-full bg-white text-black py-2 rounded-lg hover:bg-gray-200 transition"
          disabled={loading}
        >
          {loading ? 'Thinking...' : 'Ask'}
        </button>

      </form>

      {response && (
        <div className="mt-6 w-full max-w-md bg-black border border-white p-4 rounded-lg shadow">
          <h2 className="font-semibold mb-2 text-white">Response:</h2>
          <p>{response}</p>
        </div>
      
      )}
    </div>
  )
}
