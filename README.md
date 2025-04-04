# Chatbot Portfolio (Pranav K. Sudhir)

This is a serverless, AI-powered chatbot web app designed to showcase and answer questions about my portfolio, experience, and projects. It's built with modern web technologies and hosted seamlessly with a scalable serverless backend.

## Live Demo

> [https://portfoliobot.vercel.app/]

---

## Tech Stack

### Frontend
- **React** with **Vite**
- **Tailwind CSS** for sleek styling
- **Deployed on [Vercel](https://vercel.com)** as a serverless frontend

### Backend
- **Node.js (Serverless API)** via Vercel’s `/api` route
- API endpoint: `/api/chat` (handles POST requests)
- Communicates with AI models for embeddings and responses

### Database
- **PostgreSQL with pgvector** extension
- **Hosted on [Render](https://render.com)**

### AI Models
-  **Embeddings:** Powered by **Cohere Embed API**
-  **Summarization / Chat Generation:** Powered by **Cohere Generate API**

---

## Features

- Ask questions about my experience, projects, or tech stack
- Serverless and lightweight – optimized for fast, low-cost hosting
- Dynamic text input with real-time responses
- AI-powered retrieval and summarization

---

## 🛠️ Local Development

### Prerequisites:
- Node.js 18+
- Vite
- TailwindCSS
- A `.env` file with your Cohere and DB credentials (see `.env.example`)

### Setup

```bash
# Install dependencies
npm install

# Run local dev server
npm run dev

###Environment Variables
COHERE_API_KEY=your_cohere_key
PG_HOST=your_postgres_host
PG_USER=your_postgres_user
PG_DATABASE=your_db_name
PG_PASSWORD=your_password
PG_PORT=5432


# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript and enable type-aware lint rules. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
