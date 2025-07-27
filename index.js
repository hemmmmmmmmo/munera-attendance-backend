const express = require('express');
const { google } = require('googleapis');
const dotenv = require('dotenv');
const cors = require('cors');
const moment = require('moment');

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

// Google Auth Setup
const auth = new google.auth.JWT(
  process.env.GOOGLE_SERVICE_EMAIL,
  null,
  process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
  ['https://www.googleapis.com/auth/spreadsheets']
);

const sheets = google.sheets({ version: 'v4', auth });

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const SHEET_NAME = 'Delegates'; // You can rename this if needed

// Utility: Get current day of event (Day 1/2/3)
function getCurrentDay() {
  const today = new Date();
  const startDate = new Date('2025-10-01'); // Replace with your real Day 1
  const diff = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
  return `Day ${diff + 1}`;
}

// Utility: Get current time in HH:mm format
function getTimeNow() {
  return moment().format('HH:mm');
}

// Utility: Determine status
function getStatus(timestamp) {
  const hour = parseInt(timestamp.split(':')[0], 10);
  const minute = parseInt(timestamp.split(':')[1], 10);
  if (hour < 9 || (hour === 9 && minute <= 5)) return 'Present';
  else if (hour >= 9 && hour < 10) return 'Late';
  else return 'Absent';
}

// Main Attendance Route
app.post('/attendance', async (req, res) => {
  const { id, scannedBy } = req.body;

  try {
    const sheetData = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}`,
    });

    const rows = sheetData.data.values;
    if (!rows) return res.status(404).send('No data found.');

    const header = rows[0];
    const idIndex = header.indexOf('ID');
    const scanIndex = header.indexOf('Last Scan Timestamp');
    const scanByIndex = header.indexOf('Scanned By');

    const rowIndex = rows.findIndex(row => row[idIndex] === id);

    if (rowIndex === -1) {
      return res.status(404).json({ error: 'Delegate not found' });
    }

    const now = getTimeNow();
    const status = getStatus(now);
    const day = getCurrentDay();
    const statusCol = `${day} Status`;
    const timeCol = `${day} Time`;

    const statusIndex = header.indexOf(statusCol);
    const timeIndex = header.indexOf(timeCol);

    const updateRange = `${SHEET_NAME}!${String.fromCharCode(65 + statusIndex)}${rowIndex + 1}:${String.fromCharCode(65 + scanByIndex)}${rowIndex + 1}`;
    const updateValues = [
      [status, now, moment().format('YYYY-MM-DD HH:mm:ss'), scannedBy]
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: updateRange,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: updateValues
      }
    });

    res.json({ id, time: now, status, scannedBy });

  } catch (err) {
    console.error('Attendance error:', err);
    res.status(500).send('Server error');
  }
});

app.listen(port, () => {
  console.log(`✅ MUNERA Attendance backend running at http://localhost:${port}`);
});
