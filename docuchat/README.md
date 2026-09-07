# Lexara AI

Lexara AI is a document-grounded AI assistant. Upload files, attach research papers or Hugging Face model documentation, and ask questions that are answered from the indexed sources. The application also supports optional Face ID sign-in in compatible browsers.

## Highlights

- Lexara AI chat with source-aware responses and conversation history
- PDF, DOC, DOCX, TXT, and Markdown uploads up to 20 MB per file
- arXiv paper search and attachment
- Hugging Face model search and README attachment
- Password authentication with JWT sessions
- Optional browser-based Face ID registration and login
- Persistent chats, documents, and vector chunks in MongoDB

## Requirements

- Node.js 18 or newer
- MongoDB 6 or newer, running locally or hosted through MongoDB Atlas
- A Groq API key for chat completions
- A modern browser with camera access if Face ID is enabled

## Quick Start

Run the following commands from the project directory containing `backend/` and `frontend/`.

### 1. Configure the backend

```bash
cd backend
npm install
```

Create `backend/.env`:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/docuchat
JWT_SECRET=replace-with-a-long-random-secret
GROQ_API_KEY=your-groq-api-key
GROQ_MODEL=openai/gpt-oss-20b
FRONTEND_URL=http://localhost:3000
```

`MONGODB_URI`, `JWT_SECRET`, and `GROQ_API_KEY` should be set for a complete installation. The server uses MongoDB on the default local URI and port 5000 when those values are omitted, but authentication and chat persistence require a working database and JWT secret.

### 2. Install and start the frontend

In a second terminal:

```bash
cd frontend
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000). The React development server proxies `/api` requests to the backend at `http://localhost:5000`.

### 3. Download Face ID models

Face ID is optional. The models are loaded from `frontend/public/models/` at runtime. From the project directory, use the script for your platform:

**Windows PowerShell**

```powershell
powershell -ExecutionPolicy Bypass -File .\download-face-models.ps1
```

**macOS/Linux**

```bash
chmod +x ./download-face-models.sh
./download-face-models.sh
```

The app can still be used with email and password authentication when these files are not installed.

## Available Commands

### Backend

```bash
npm start       # Start the production-style Node server
npm run dev     # Start the server with nodemon
```

### Frontend

```bash
npm start       # Start the React development server
npm run build   # Create a production build in frontend/build
```

## How It Works

1. A user creates a chat and uploads a local document or attaches an external source.
2. The backend extracts text and splits it into overlapping chunks.
3. Each chunk is embedded with `Xenova/all-MiniLM-L6-v2` and stored with the chat in MongoDB.
4. A question is embedded and compared with stored chunks using cosine similarity.
5. The five most relevant chunks and recent conversation history are sent to Groq.
6. The system prompt instructs the model to answer only from the supplied excerpts and identify the source. If no relevant context is found, the assistant declines to answer from outside the attached documents.

Embeddings are generated locally through `@xenova/transformers`; only the grounded chat completion is sent to Groq.

## API Overview

All chat endpoints require a Bearer JWT returned by authentication endpoints.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/signup` | Create an account, optionally with a face descriptor |
| `POST` | `/api/auth/login` | Sign in with email and password |
| `POST` | `/api/auth/face-login` | Sign in with a registered face descriptor |
| `GET` | `/api/chats` | List the current user's chats |
| `POST` | `/api/chats` | Create a chat |
| `POST` | `/api/chats/:id/upload` | Upload and index a local document |
| `POST` | `/api/chats/:id/message` | Ask a question about the chat sources |
| `GET` | `/api/chats/search/arxiv?q=...` | Search arXiv papers |
| `GET` | `/api/chats/search/huggingface?q=...` | Search Hugging Face models |
| `GET` | `/api/health` | Check server availability |

## Project Layout

```text
docuchat/
├── backend/
│   ├── middleware/       # JWT authentication
│   ├── models/           # User and Chat Mongoose schemas
│   ├── routes/           # Authentication and chat APIs
│   ├── services/         # Text extraction and RAG orchestration
│   ├── uploads/          # Temporary upload location
│   └── server.js
├── frontend/
│   ├── public/models/     # face-api.js model weights
│   └── src/
│       ├── components/   # Chat, document, and sidebar UI
│       ├── pages/        # Authentication and dashboard screens
│       ├── styles/       # Global styles
│       └── utils/        # API, auth context, and Face ID hook
├── download-face-models.ps1
└── download-face-models.sh
```

## Security Notes

- Keep `backend/.env` out of version control and use a unique, high-entropy `JWT_SECRET`.
- Face descriptors are sensitive biometric data. Use HTTPS in deployed environments and restrict database access.
- Uploaded files are temporarily written to `backend/uploads/`, extracted, indexed, and then removed.
- The backend applies security headers, CORS restrictions, request limits, and API rate limiting.

## Troubleshooting

- **MongoDB connection failed:** verify `MONGODB_URI` and confirm that the database is reachable.
- **Chat requests fail:** verify `GROQ_API_KEY` and `GROQ_MODEL` in `backend/.env`.
- **Face ID is unavailable:** run the model download script and allow camera access in the browser.
- **Frontend cannot reach the API:** ensure the backend is running on port 5000, or update the frontend proxy and `FRONTEND_URL` together.
