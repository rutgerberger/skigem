import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from langchain_core.tools import tool

@tool("scrape_website")
def scrape_website(url: str) -> str:
    """
    Fetches and extracts the main text and primary images from a chalet website URL.
    Use this to find exact prices, detailed descriptions, and image URLs.
    """
    print(f"   🕸️ [Web Scraper] Visiting: {url}")
    try:
        # Standard headers to bypass basic anti-bot protections on chalet sites
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
        }
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()

        soup = BeautifulSoup(response.content, 'html.parser')

        # Strip out noisy, irrelevant tags to save LLM token context
        for tag in soup(['script', 'style', 'nav', 'header', 'footer', 'aside', 'meta']):
            tag.decompose()

        # Extract the visible text
        text_content = ' '.join(soup.stripped_strings)
        # Limit to the first 3000 characters so we don't blow up the LLM's context window
        text_content = text_content[:3000]

        # Extract up to 3 significant images
        images = []
        for img in soup.find_all('img'):
            src = img.get('src') or img.get('data-src')
            if not src:
                continue
            
            # Basic filter to skip logos, icons, and UI elements
            src_lower = src.lower()
            if any(x in src_lower for x in ['logo', 'icon', 'button', 'spinner', 'avatar', '.svg']):
                continue
            
            # Convert relative URLs (like /images/chalet1.jpg) to absolute URLs
            abs_url = urljoin(url, src)
            
            if abs_url not in images:
                images.append(abs_url)
            
            if len(images) >= 3:
                break

        images_str = "\n".join(images) if images else "No suitable images found."

        return f"--- SCRAPED CONTENT FROM {url} ---\n\nTEXT:\n{text_content}...\n\nMAIN IMAGES:\n{images_str}"

    except Exception as e:
        return f"Failed to scrape {url}: {str(e)}"