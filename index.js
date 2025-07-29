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
const SHEET_NAME = 'Delegates'; // Make sure this matches your sheet tab name

// Get current event day (Day 1, 2, 3)
function getCurrentDay() {
  const today = new Date();
  const startDate = new Date('2025-10-01'); // 🔁 Replace this with your real Day 1
  const diff = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
  return `Day ${diff + 1}`;
}

// Get current time in HH:mm
function getTimeNow() {
  return moment().format('HH:mm');
}

// Determine status based on time
function getStatus(time) {
  const [hour, minute] = time.split(':').map(Number);
  if (hour < 9 || (hour === 9 && minute <= 5)) return 'Present';
  if (hour < 10) return 'Late';
  return 'Absent';
}

// === Attendance Endpoint ===
app.post('/attendance', async (req, res) => {
  const { id, scannedBy } = req.body;

  try {
    const sheet = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: SHEET_NAME
    });

    const rows = sheet.data.values;
    if (!rows) return res.status(404).send('No data found.');

    const header = rows[0];
    const idIndex = header.indexOf('ID');
    const scanByIndex = header.indexOf('Scanned By');
    const scanTimeIndex = header.indexOf('Last Scan Timestamp');

    const rowIndex = rows.findIndex(row => row[idIndex] === id);
    if (rowIndex === -1) {
      return res.status(404).json({ error: 'Delegate not found' });
    }

    const now = getTimeNow();
    const fullTimestamp = moment().format('YYYY-MM-DD HH:mm:ss');
    const status = getStatus(now);
    const day = getCurrentDay();
    const statusCol = `${day} Status`;
    const timeCol = `${day} Time`;

    const statusIndex = header.indexOf(statusCol);
    const timeIndex = header.indexOf(timeCol);

    const updateRange = `${SHEET_NAME}!${String.fromCharCode(65 + statusIndex)}${rowIndex + 1}:${String.fromCharCode(65 + scanByIndex)}${rowIndex + 1}`;
    const updateValues = [[status, now, fullTimestamp, scannedBy]];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: updateRange,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: updateValues }
    });

    res.json({ id, time: now, status, scannedBy });

  } catch (err) {
    console.error('Attendance error:', err);
    res.status(500).send('Server error');
  }
});

// === Server Start ===
app.listen(port, () => {
  console.log(`✅ MUNERA Attendance backend running at http://localhost:${port}`);
});
