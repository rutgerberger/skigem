# 🏔️ SkiGem Orchestra

An AI-powered multi-agent system designed to scour the deep, uncommercialized corners of the internet to find hidden wintersport gems. It filters ski resorts based on strict criteria and hunts down affordable, perfectly located chalets—explicitly avoiding mega-aggregators like Booking.com or Airbnb.

## 🎻 The Orchestra (Agent Roles)

This system uses a multi-agent framework where each AI agent has a highly specialized role:

1. **The Resort Scout (`resort_scout_agent.py`):** Takes your criteria (e.g., >50km of slopes, Austria or France, high altitude) and searches databases/web to curate a list of 3-5 hidden gem ski areas.
2. **The Deep Web Hunter (`chalet_hunter_agent.py`):** Takes the resorts found by the Scout and searches for chalets. **Crucially, it uses search operators to exclude major sites** (e.g., `-site:booking.com -site:airbnb.com`) and translates queries into local languages (e.g., *"Ferienwohnung direkt an der Piste"*, *"Gîte au pied des pistes"*) to find local tourist boards and independent owner websites.
3. **The Scraper (`scraper_tool.py`):** A custom tool built with Playwright/BeautifulSoup that bypasses basic bot protections to read the text on these obscure local websites and extract pricing, distance to the ski lift, and contact info.
4. **The Deal Evaluator (`evaluator_agent.py`):** Cross-references the scraped data against your strict requirements (price, proximity to lift) and outputs a final, ranked report with direct links.

## 📂 Project Structure

```text
skigem-orchestra/
│
├── .env                        # API keys (OpenAI/Gemini, Serper API, etc.)
├── requirements.txt            # Python dependencies (crewai, playwright, bs4, etc.)
├── main.py                     # The main entry point that orchestrates the crew
│
├── config/
│   ├── settings.yaml           # Global configurations and search operators
│   └── criteria.json           # Your specific inputs (slope km, budget, distance to lift)
│
├── src/
│   ├── __init__.py
│   │
│   ├── agents/                 # The AI Agents (The Musicians)
│   │   ├── __init__.py
│   │   ├── resort_scout.py     # Agent: Finds the ski areas
│   │   ├── chalet_hunter.py    # Agent: Finds the URLs of hidden chalets
│   │   └── evaluator.py        # Agent: Ranks and formats the final output
│   │
│   ├── tasks/                  # The specific instructions for each agent (The Sheet Music)
│   │   ├── __init__.py
│   │   ├── scout_tasks.py
│   │   ├── hunt_tasks.py
│   │   └── evaluate_tasks.py
│   │
│   └── tools/                  # The tools the agents use to interact with the world (The Instruments)
│       ├── __init__.py
│       ├── search_engine.py    # Uses SerpAPI/DuckDuckGo with negative parameters (-booking.com)
│       └── deep_scraper.py     # Playwright script to scrape JS-heavy local chalet sites
│
└── output/
    └── hidden_gems_report.md   # The final generated itinerary and links

```

## 🚀 Getting Started

### 1. Prerequisites

* Python 3.10+
* An LLM API key (e.g., Google Gemini 2.0 or OpenAI GPT-4o).
* A Search API key (e.g., Serper.dev or Tavily) to allow the agents to Google things.

### 2. Installation

Clone the repository and install the dependencies:

```bash
git clone https://github.com/yourusername/skigem-orchestra.git
cd skigem-orchestra
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
playwright install  # Installs the browser binaries for the deep web scraper

```

### 3. Configuration

1. Rename `.env.example` to `.env` and add your API keys.
2. Open `config/criteria.json` and set your dream holiday parameters:

```json
{
  "min_slope_km": 60,
  "countries": ["Austria", "Italy"],
  "max_price_per_night_eur": 120,
  "max_distance_to_lift_meters": 500,
  "vibe": "authentic, quiet, no massive hotels"
}

```

### 4. Run the Orchestra

```bash
python main.py

```

Grab a coffee. The agents will talk to each other, search the web, scrape obscure local sites, and generate your `hidden_gems_report.md` in the `output/` folder.

## 🕵️‍♂️ The "Holes of the Internet" Strategy

To ensure the AI doesn't just hand you an Expedia link, the `search_engine.py` tool is hardcoded to append specific search operators to every query the AI makes:

* **Exclusions:** `-site:booking.com -site:airbnb.com -site:expedia.com -site:tripadvisor.com -site:tui.com`
* **Inclusions:** `intext:"skipass" AND intext:"chalet" OR intext:"apartment"`
* **Local Domains:** Restricting searches to `.at` (Austria), `.ch` (Switzerland), or `.fr` (France) to prioritize local tourism board aggregators (like *[townname].at*).