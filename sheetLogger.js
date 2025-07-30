const { google } = require('googleapis');
const moment = require('moment'); // Add this if not already

const spreadsheetId = process.env.GOOGLE_SHEET_ID; // Loaded from .env
const range = 'Delegates'; // Your sheet tab name

async function logToGoogleSheet(delegateId, time, scannedBy, status) {
  const auth = new google.auth.GoogleAuth({
    keyFile: 'google-service-account.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const rows = response.data.values;
  const headers = rows[0];

  const idIndex = headers.indexOf('ID');
  const timeIndex = headers.indexOf('Last Scan Timestamp');
  const byIndex = headers.indexOf('Scanned By');

  const rowIndex = rows.findIndex(row => row[idIndex] === delegateId);
  if (rowIndex === -1) throw new Error("Delegate not found in sheet");

  const updateRange = `${range}!${String.fromCharCode(65 + timeIndex)}${rowIndex + 1}:${String.fromCharCode(65 + byIndex)}${rowIndex + 1}`;

  const formatted = `${status} (${moment(time, "HH:mm").format("h:mm A")})`;
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
