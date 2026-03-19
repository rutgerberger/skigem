# 🏔️ SkiGem Orchestra

SkiGem Orchestra is a multi-agent AI system designed to scour the "holes of the internet" to find the perfect, hidden-gem ski resorts and chalets. 

Built with a TypeScript/Next.js frontend and a Python multi-agent backend, this system uses an "orchestra" of specialized AI agents to plan the ultimate winter sports holiday based on highly specific user criteria.

## ✨ Features

* **Criteria-Based Resort Scouting:** Filters European (or global) ski areas based on slope length, altitude, and country.
* **Deep-Web Chalet Hunting:** Finds standalone chalets on global sites, but also local tourism boards, independent property sites, and niche forums.
* **Intelligent Evaluation:** Scores found chalets against strict user requirements (e.g., price limits, walking distance to ski lifts).
* **Modern UI:** A clean, responsive frontend built with Next.js, React, and Tailwind CSS.

## 🏗️ Architecture (The Orchestra)

The backend is powered by **CrewAI / LangGraph**, orchestrating three distinct agents:

1. **The Resort Scout ⛷️:** Uses search APIs and ski-resort databases to find regions that match the overarching criteria (e.g., "At least 150km of slopes in Austria").
2. **The Chalet Hunter 🏡:** Takes the resort list and uses web-scraping tools (Playwright/BeautifulSoup) to crawl local websites, Google Maps data, and independent booking sites for chalets.
3. **The Evaluator ⚖️:** Parses the scraped data (price, distance to lift, amenities) and filters out anything that doesn't perfectly match the user's requirements.

## 🛠️ Tech Stack

* **Frontend:** Next.js, TypeScript, Tailwind CSS, React Query
* **Backend:** Python, FastAPI (for the API layer)
* **AI Orchestration:** CrewAI or LangGraph
* **LLM:** Groq API - can be simple like llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0)
* **Tools:** Playwright (Web Scraping), Tavily/Serper (Web Search)

## 🚀 Getting Started

### Prerequisites
* Node.js (v18+)
* Python (3.11+)
* OpenAI/Anthropic API Key
* Tavily/Serper API Key

### Installation

1. **Clone the repo**
   ```bash
   git clone [https://github.com/yourusername/snowgem-orchestra.git](https://github.com/yourusername/snowgem-orchestra.git)
   cd snowgem-orchestra

2. **Setup Backend**

```
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env # Add your API keys here
uvicorn app.main:app --reload

3 **Setup Frontend**

```
cd ../frontend
npm install
npm run dev


***

### 📂 The File Tree

```text
snowgem-orchestra/
├── frontend/                     # TypeScript Next.js App
│   ├── src/
│   │   ├── app/                  # Next.js App Router (Pages & Layout)
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx          # Main search UI
│   │   │   └── results/          # Results display page
│   │   ├── components/           # React Components (Forms, Chalet Cards)
│   │   ├── hooks/                # Custom hooks (API calls to backend)
│   │   └── types/                # TypeScript Interfaces (Chalet, Resort)
│   ├── package.json
│   ├── tailwind.config.ts
│   └── tsconfig.json
│
├── backend/                      # Python FastAPI & AI Orchestra
│   ├── app/
│   │   ├── api/
│   │   │   └── routes.py         # Endpoints for the frontend to call
│   │   ├── orchestra/            # The AI Logic
│   │   │   ├── agents/
│   │   │   │   ├── resort_scout.py    # Agent 1: Finds resorts
│   │   │   │   ├── chalet_hunter.py   # Agent 2: Scrapes web for chalets
│   │   │   │   └── evaluator.py       # Agent 3: Checks distance/price
│   │   │   ├── tools/
│   │   │   │   ├── web_scraper.py     # Playwright headless browser setup
│   │   │   │   └── search_api.py      # Tavily/Google Search integration
│   │   │   ├── prompts/
│   │   │   │   └── system_prompts.py  # Instructions for the LLMs
│   │   │   └── crew.py                # Wires the agents together
│   │   ├── models/               # Pydantic data models for structured output
│   │   └── main.py               # F astAPI entry point
│   ├── .env.example
│   └── requirements.txt
│
└── README.md
