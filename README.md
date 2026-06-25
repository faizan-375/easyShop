# easyShop

easyShop is a local product-search assistant with three parts:

- `backend`: Next.js API app for search, scraping, ranking, and optional AI analysis.
- `frontend`: Vite/React dashboard for viewing searches and product results.
- `extension`: Chrome extension popup that starts a search and opens the dashboard.

## Requirements

- Node.js 20.9 or newer
- npm
- Optional: MongoDB for persistent storage
- One legal search provider key for real search results:
  - SerpAPI, or
  - Google Custom Search API plus a Google CSE ID

## Environment

Copy the example file and fill in local values:

```bash
cp .env.example .env
```

Important variables:

- `PORT`: backend port, defaults to `4000`
- `CLIENT_URL`: frontend URL, defaults to `http://localhost:5173`
- `MONGODB_URI`: optional MongoDB connection string
- `SERPAPI_API_KEY`: SerpAPI key
- `GOOGLE_CSE_API_KEY` and `GOOGLE_CSE_ID`: Google Custom Search credentials
- `OPENAI_API_KEY`: optional key for AI analysis

Keep `.env` private. It is ignored by Git.

## Install

Install dependencies for each app:

```bash
cd backend
npm install

cd ../frontend
npm install
```

## Run Locally

Start the backend:

```bash
cd backend
npm run dev
```

The backend runs as a Next.js API app at `http://127.0.0.1:4000`, with routes such as `GET /api/health` and `POST /api/search`.

Start the frontend in another terminal:

```bash
cd frontend
npm run dev
```

Open the dashboard at `http://localhost:5173`.

## Chrome Extension

1. Start the backend and frontend.
2. Open Chrome extensions at `chrome://extensions`.
3. Enable Developer mode.
4. Choose "Load unpacked".
5. Select the `extension` folder.

The extension is configured for the local backend at `http://localhost:4000` and dashboard at `http://localhost:5173`.

## Checks

Run the backend syntax check:

```bash
cd backend
npm run check
```

Run the frontend production build:

```bash
cd frontend
npm run build
```
