const { google } = require('googleapis');
const moment = require('moment');

const spreadsheetId = process.env.GOOGLE_SHEET_ID;
const range = 'Delegates';

async function logToGoogleSheet(delegateId, time, scannedBy, status) {
  const auth = new google.auth.JWT(
    process.env.GOOGLE_SERVICE_EMAIL,
    null,
    process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/spreadsheets']
  );

  const client = await auth.authorize();
  const sheets = google.sheets({ version: 'v4', auth });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const rows = response.data.values;
  const headers = rows[0];

  const idIndex = headers.indexOf('ID');
  const scannedByIndex = headers.indexOf('Scanned By');
  const day = 'Day 1'; // Make sure this matches index.js

  const statusIndex = headers.indexOf(day);
  if (statusIndex === -1) throw new Error(`Missing column: ${day}`);

  const rowIndex = rows.findIndex(row => row[idIndex] === delegateId);
  if (rowIndex === -1) throw new Error("Delegate not found in sheet");

  const formatted = `${status} (${moment(time, "HH:mm").format("h:mm A")})`;
  const updateRange = `${range}!${String.fromCharCode(65 + statusIndex)}${rowIndex + 1}:${String.fromCharCode(65 + scannedByIndex)}${rowIndex + 1}`;
  const values = [[formatted, scannedBy]];

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: updateRange,
    valueInputOption: 'RAW',
    requestBody: { values },
  });

  return true;
}

module.exports = { logToGoogleSheet };
