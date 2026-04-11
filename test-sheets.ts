import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config();

async function testConnection() {
  console.log("Testing Google Sheets connection...");
  
  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS;
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  if (!credentials) {
    console.error("❌ GOOGLE_SERVICE_ACCOUNT_CREDENTIALS is not set in environment.");
    return;
  }

  if (!spreadsheetId) {
    console.error("❌ GOOGLE_SHEET_ID is not set in environment.");
    return;
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(credentials),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    
    console.log(`Attempting to fetch spreadsheet metadata for ID: ${spreadsheetId}`);
    const response = await sheets.spreadsheets.get({ spreadsheetId });
    
    console.log("✅ Successfully connected to Google Sheets!");
    console.log(`Spreadsheet Title: ${response.data.properties?.title}`);
    console.log("Sheets found:", response.data.sheets?.map(s => s.properties?.title).join(", "));
    
  } catch (error: any) {
    console.error("❌ Failed to connect to Google Sheets.");
    console.error("Error details:", error.message || error);
    if (error.message?.includes("Permission denied") || error.message?.includes("403")) {
      console.error("\nTIP: Make sure you shared the sheet with the Service Account email found in your JSON key.");
    }
  }
}

testConnection();
