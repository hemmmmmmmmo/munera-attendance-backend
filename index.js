const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const moment = require('moment-timezone');
const { logToGoogleSheet } = require('./sheetLogger');
const { google } = require('googleapis');

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

// 🔁 Get current MUNERA event day (Nov 20 = Day 1)
function getCurrentDay() {
  const now = moment.tz("Asia/Dubai");
  const day1Start = moment.tz("2025-11-20 10:00", "Asia/Dubai");
  const diff = now.diff(day1Start, 'days');

  if (diff < 0 || diff > 2) return null; // Not in 3-day range
  return `Day ${diff + 1}`;
}

// 🔁 Determine attendance status
function getStatus() {
  const now = moment.tz("Asia/Dubai");
  const cutoffPresent = moment(now).hour(10).minute(5);
  const cutoffLate = moment(now).hour(11).minute(0);

  if (now.isBefore(cutoffPresent)) return 'Present';
  if (now.isBefore(cutoffLate)) return 'Late';
  return 'Absent';
}

// === SCAN ROUTE ===
app.post('/scan', async (req, res) => {
  const { id, scannedBy } = req.body;

  if (!id) return res.status(400).json({ error: 'Missing delegate ID' });

  try {
    const day = "Day 1"; // 🔁 Force Day 1 during testing


    const timeNow = moment.tz("Asia/Dubai").format("HH:mm");
    const fullTimestamp = moment.tz("Asia/Dubai").format("YYYY-MM-DD HH:mm:ss");
    const status = getStatus();
    const name = scannedBy || "MUNERA Staff";

    // 🔍 Connect to Google Sheets
    const auth = new google.auth.JWT(
      process.env.GOOGLE_SERVICE_EMAIL,
      null,
      process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/spreadsheets']
    );
    const sheets = google.sheets({ version: 'v4', auth });

    const SHEET_NAME = 'Delegates';
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: SHEET_NAME,
    });

    const rows = response.data.values;
    const header = rows[0];

    const idIndex = header.indexOf("ID");
    const statusIndex = header.indexOf(`${day} Status`);
    const timeIndex = header.indexOf(`${day} Time`);
    const scanByIndex = header.indexOf("Scanned By");

    const rowIndex = rows.findIndex(row => row[idIndex] === id);
    if (rowIndex === -1) {
      return res.status(404).json({ error: "Delegate not found in sheet" });
    }

    const alreadyStatus = rows[rowIndex][statusIndex];
    const alreadyTime = rows[rowIndex][timeIndex];
    const alreadyBy = rows[rowIndex][scanByIndex];

    if (alreadyStatus === "Present" || alreadyStatus === "Late") {
      return res.status(409).json({
        error: `Already scanned today at ${alreadyTime || "unknown"} by ${alreadyBy || "unknown"}`
      });
    }

    // ✅ Not scanned yet — mark attendance
    await logToGoogleSheet(id, timeNow, name,status);

    return res.json({ message: `Marked ${status} at ${timeNow}` });
  } catch (err) {
    console.error('[❌ Attendance Error]:', err.message || err);
    return res.status(500).json({ error: 'Server error while scanning' });
  }
});

app.get('/', (req, res) => {
  res.send('✅ MUNERA Attendance API is live');
});

app.listen(port, () => {
  console.log(`✅ MUNERA Attendance backend running at http://localhost:${port}`);
});
