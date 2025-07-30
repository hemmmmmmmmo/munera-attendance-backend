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

  const sheets = google.sheets({ version: 'v4', auth });

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
