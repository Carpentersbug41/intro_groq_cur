// index.js

// ---------- Google Sheets API Setup ----------
const { google } = require('googleapis');
// Load your Google Sheets service account credentials
const sheetsKeys = require('./credentials.json');
console.log("Loaded Google Sheets credentials:", sheetsKeys);

async function appendDataToSheet(rows) {
  // Create a JWT client using your Sheets credentials
  const client = new google.auth.JWT(
    sheetsKeys.client_email,
    null,
    sheetsKeys.private_key,
    ['https://www.googleapis.com/auth/spreadsheets']
  );

  await client.authorize();
  const sheets = google.sheets({ version: 'v4', auth: client });
  const request = {
    spreadsheetId: '1w-HUg8TImPbWre_Bn19XjuHnzNV3ZCP6hT-v9n-gAd0', // Your spreadsheet ID
    range: 'Sheet1!A:B',
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    resource: {
      values: rows,
    },
  };

  try {
    const response = await sheets.spreadsheets.values.append(request);
    console.log('Data appended successfully:', response.data);
  } catch (error) {
    console.error('Error appending data to Google Sheet:', error);
  }
}

// ---------- Firebase Admin Setup ----------
const admin = require('firebase-admin');
const firebaseCredentials = require('./firebase-credentials.json');

admin.initializeApp({
  credential: admin.credential.cert(firebaseCredentials)
});
const firestore = admin.firestore();
console.log("Firebase Admin initialized successfully!");

// ---------- One-Time Sync (Optional) ----------
// This function fetches all existing documents once and appends them.
async function syncFirebaseToSheet() {
  try {
    const snapshot = await firestore.collection('userResponses').get();
    const rows = [];

    snapshot.forEach(doc => {
      // Log each document's ID and data for debugging
      console.log(`Document ID: ${doc.id}`, doc.data());
      const data = doc.data();
      let row = [];
      
      // Adjust field mapping based on your document ID
      if (doc.id === 'favoriteMusicDoc') {
        row = [data.favoriteMusic || '', data.favoriteMusicInput || ''];
      } else if (doc.id === 'userNameDoc') {
        row = [data.userName || '', data.userNameInput || ''];
      } else {
        // Fallback: try generic field names
        row = [data.result || '', data.userresult || ''];
      }
      rows.push(row);
    });

    console.log("Fetched rows from Firebase:", rows);

    if (rows.length === 0) {
      console.log("No data found in Firebase.");
      return;
    }

    await appendDataToSheet(rows);
  } catch (error) {
    console.error("Error syncing Firebase data to Google Sheets:", error);
  }
}

// Uncomment the following line if you want to perform a one-time sync when the script starts:
// syncFirebaseToSheet();

// ---------- Real-Time Listener for Firestore Changes ----------
firestore.collection('userResponses')
  .onSnapshot(snapshot => {
    const rows = [];
    snapshot.docChanges().forEach(change => {
      if (change.type === 'added') {
        const doc = change.doc;
        console.log(`New document added: ${doc.id}`, doc.data());
        const data = doc.data();
        let row = [];
        if (doc.id === 'favoriteMusicDoc') {
          row = [data.favoriteMusic || '', data.favoriteMusicInput || ''];
        } else if (doc.id === 'userNameDoc') {
          row = [data.userName || '', data.userNameInput || ''];
        } else {
          row = [data.result || '', data.userresult || ''];
        }
        rows.push(row);
      }
    });
    if (rows.length > 0) {
      appendDataToSheet(rows);
    }
  }, error => {
    console.error("Error listening to Firestore changes:", error);
  });
