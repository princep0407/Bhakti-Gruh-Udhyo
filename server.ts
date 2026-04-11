import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { google } from "googleapis";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Server is running" });
  });

  // API route to save data to Google Sheets
  app.post("/api/save-data", async (req, res) => {
    console.log("Received request to /api/save-data");
    const { data, sheetName } = req.body;
    console.log("Sheet Name:", sheetName);
    console.log("Data length:", Array.isArray(data) ? data.length : 1);
    
    try {
      if (!process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS) {
        console.error("GOOGLE_SERVICE_ACCOUNT_CREDENTIALS is missing");
        throw new Error("GOOGLE_SERVICE_ACCOUNT_CREDENTIALS is not set");
      }
      if (!process.env.GOOGLE_SHEET_ID) {
        console.error("GOOGLE_SHEET_ID is missing");
        throw new Error("GOOGLE_SHEET_ID is not set");
      }

      console.log("Using Spreadsheet ID:", process.env.GOOGLE_SHEET_ID);

      const auth = new google.auth.GoogleAuth({
        credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS),
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });

      const sheets = google.sheets({ version: "v4", auth });
      const spreadsheetId = process.env.GOOGLE_SHEET_ID;

      // Check if sheet exists, if not create it
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
      const sheetExists = spreadsheet.data.sheets?.some(s => s.properties?.title === sheetName);

      if (!sheetExists) {
        console.log(`Sheet "${sheetName}" does not exist. Creating it...`);
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [{
              addSheet: {
                properties: { title: sheetName }
              }
            }]
          }
        });
        
        // Add headers if it's a new sheet
        const headers = Array.isArray(data) && data.length > 0 
          ? Object.keys(data[0]) 
          : (!Array.isArray(data) ? Object.keys(data) : []);
          
        if (headers.length > 0) {
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${sheetName}!A1`,
            valueInputOption: "USER_ENTERED",
            requestBody: {
              values: [headers],
            },
          });
        }
      }

      // Convert data to rows
      const rows = Array.isArray(data) 
        ? data.map(item => Object.values(item))
        : [Object.values(data)];

      console.log(`Appending ${rows.length} rows to sheet: ${sheetName}`);

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: rows,
        },
      });

      res.json({ status: "ok" });
    } catch (error: any) {
      console.error("Error saving to Google Sheets:", error.message || error);
      res.status(500).json({ 
        error: "Failed to save to Google Sheets", 
        details: error.message || "Unknown error" 
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
