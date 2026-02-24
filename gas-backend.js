/**
 * Google Apps Script — Bath Foundry Scheduler Backend
 * ====================================================
 * 
 * SETUP INSTRUCTIONS:
 * 
 * 1. Go to https://script.google.com
 * 2. Click "New project"
 * 3. Delete any existing code in Code.gs
 * 4. Paste ONLY the doGet and doPost functions below (not these comments)
 * 5. Click the floppy disk icon to save
 * 6. Click "Deploy" → "New deployment"
 * 7. Click the gear icon next to "Select type" → choose "Web app"
 * 8. Set:
 *    - Description: "BF Scheduler Backend"
 *    - Execute as: "Me (the@sirellery.com)"
 *    - Who has access: "Anyone"
 * 9. Click "Deploy"
 * 10. Click "Authorize access" → choose your Google account → Allow
 * 11. Copy the Web app URL (looks like https://script.google.com/macros/s/xxx/exec)
 * 12. Open the Bath Foundry Scheduler app
 * 13. Click the ⚙️ gear icon in the header
 * 14. Paste the URL and click Save
 * 
 * NOTE: The script automatically creates data in cell A1 of the active sheet.
 * You can create a new Google Sheet first, then open Apps Script from
 * Extensions → Apps Script in that sheet.
 * 
 * REDEPLOYING AFTER CHANGES:
 * If you edit the script, you must create a NEW deployment (Deploy → New deployment)
 * or update the existing one (Deploy → Manage deployments → Edit → New version).
 * 
 * ─── PASTE THIS INTO Code.gs ───
 */

function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getRange('A1').getValue();
  if (!data) {
    data = '[]';
  }
  return ContentService.createTextOutput(data).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var contents = e.postData.contents;
  
  // Google Sheets cell limit is 50,000 chars. If data is too large,
  // split across multiple cells.
  if (contents.length <= 50000) {
    sheet.getRange('A1').setValue(contents);
    // Clear any overflow cells from previous large saves
    sheet.getRange('A2').setValue('');
  } else {
    // Split into 50k chunks across rows
    var chunks = [];
    for (var i = 0; i < contents.length; i += 50000) {
      chunks.push(contents.substring(i, i + 50000));
    }
    for (var c = 0; c < chunks.length; c++) {
      sheet.getRange('A' + (c + 1)).setValue(chunks[c]);
    }
    // Clear any extra cells from previous saves
    var nextCell = chunks.length + 1;
    if (sheet.getRange('A' + nextCell).getValue()) {
      sheet.getRange('A' + nextCell).setValue('');
    }
  }
  
  return ContentService.createTextOutput(JSON.stringify({status: 'ok'}))
    .setMimeType(ContentService.MimeType.JSON);
}

// Updated doGet that handles chunked data
function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getRange('A1').getValue();
  if (!data) {
    return ContentService.createTextOutput('[]').setMimeType(ContentService.MimeType.JSON);
  }
  
  // Check for chunked data in subsequent cells
  var fullData = String(data);
  var row = 2;
  while (true) {
    var chunk = sheet.getRange('A' + row).getValue();
    if (!chunk) break;
    fullData += String(chunk);
    row++;
  }
  
  return ContentService.createTextOutput(fullData).setMimeType(ContentService.MimeType.JSON);
}
