import gspread
from oauth2client.service_account import ServiceAccountCredentials
import os

def append_to_sheets(resort_name: str, chalets: list):
    """Handles the actual Google Sheets API communication."""
    try:
        scope = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]
        # Assumes service_account.json is in the root
        base_path = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
        json_path = os.path.join(base_path, "service_account.json")
        
        creds = ServiceAccountCredentials.from_json_keyfile_name(json_path, scope)
        client = gspread.authorize(creds)
        
        # Make sure the Sheet Name matches exactly
        sheet = client.open("Wintersport").sheet1
        
        rows = []
        for c in chalets:
            rows.append([
                resort_name,
                c.get("name"),
                c.get("village"),
                c.get("price_per_night"),
                c.get("hidden_gem_score"),
                c.get("url"),
                c.get("reasoning")[:200] # Truncate for sheet readability
            ])
            
        sheet.append_rows(rows)
        print(f"📊 [Sheets Sync] Successfully logged {len(rows)} chalets.")
    except Exception as e:
        print(f"❌ [Sheets Sync] Error: {str(e)}")