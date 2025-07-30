const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const moment = require('moment-timezone'); // Make sure you have moment-timezone
const { logToGoogleSheet } = require('./sheetLogger');

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
    const day = getCurrentDay();
    if (!day) {
      return res.status(403).json({ error: 'Outside of MUNERA attendance dates' });
    }

    const timeNow = moment.tz("Asia/Dubai").format("HH:mm");
    const fullTimestamp = moment.tz("Asia/Dubai").format("YYYY-MM-DD HH:mm:ss");
    const status = getStatus();

    await logToGoogleSheet(id, timeNow, scannedBy || "MUNERA Staff");

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
