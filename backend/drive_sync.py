import os
import sqlite3
import json
import gspread
from google.oauth2.service_account import Credentials
from dotenv import load_dotenv

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
dotenv_path = os.path.join(BASE_DIR, '.env')
load_dotenv(dotenv_path)

DB_DIR = os.path.join(BASE_DIR, "db_storage")
DB_FILE = os.path.join(DB_DIR, "rainbow_erp.db")

SPREADSHEET_ID = os.getenv("SPREADSHEET_ID")
CREDS_JSON_STR = os.getenv("GOOGLE_CREDENTIALS_JSON", "{}")

def get_gspread_client():
    if not CREDS_JSON_STR or CREDS_JSON_STR == "{}":
        print("No valid GOOGLE_CREDENTIALS_JSON found.")
        return None
    try:
        creds_dict = json.loads(CREDS_JSON_STR)
        creds = Credentials.from_service_account_info(
            creds_dict, 
            scopes=[
                "https://www.googleapis.com/auth/spreadsheets",
                "https://www.googleapis.com/auth/drive"
            ]
        )
        return gspread.authorize(creds)
    except Exception as e:
        print(f"Error authenticating with Google Drive: {e}")
        return None

def sync_to_cloud():
    if not SPREADSHEET_ID:
        print("SPREADSHEET_ID is missing.")
        return {"status": "error", "message": "SPREADSHEET_ID is missing"}

    client = get_gspread_client()
    if not client:
        return {"status": "error", "message": "Failed to authenticate"}

    try:
        sh = client.open_by_key(SPREADSHEET_ID)
    except Exception as e:
        print(f"Failed to open spreadsheet: {e}")
        return {"status": "error", "message": str(e)}

    if not os.path.exists(DB_FILE):
        return {"status": "error", "message": "Database file not found"}

    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        
        # Get all tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        
        for (table_name,) in tables:
            if table_name.startswith("sqlite_"):
                continue
            
            cursor.execute(f"PRAGMA table_info({table_name})")
            columns = [col[1] for col in cursor.fetchall()]
            
            cursor.execute(f"SELECT * FROM {table_name}")
            rows = cursor.fetchall()
            
            try:
                worksheet = sh.worksheet(table_name)
                worksheet.clear()
            except gspread.exceptions.WorksheetNotFound:
                worksheet = sh.add_worksheet(title=table_name, rows=max(100, len(rows) + 10), cols=max(20, len(columns)))
            
            data = [columns]
            for row in rows:
                data.append([str(item) if item is not None else "" for item in row])
            
            if data:
                worksheet.update(values=data, range_name='A1')
                
        conn.close()
        print("Successfully synced all tables to Google Sheets.")
        return {"status": "success", "message": "Sync complete"}
    except Exception as e:
        print(f"Error syncing to cloud: {e}")
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Sync Rainbow ERP to Google Sheets")
    parser.add_argument("--pull", action="store_true", help="Pull (No-op for sheets)")
    parser.add_argument("--push", action="store_true", help="Push to Google Sheets")
    args = parser.parse_args()
    
    # Run sync on either push or pull to ensure main.js doesn't fail
    if args.pull or args.push:
        sync_to_cloud()
