// undo-import.js
//
// Deletes every book from a given importBatch — both the Firestore
// docs and their Cloudinary PDF files. Safe to run any time after
// import-public-domain.js, since nothing is deleted until you confirm.
//
// RUN:
//   node undo-import.js import-1234567890123
//
// (Use the batch ID printed at the end of the import script.)

const admin = require('firebase-admin');
const cloudinary = require('cloudinary').v2;
const readline = require('readline');

admin.initializeApp({
  credential: admin.credential.cert(require('./service-account.json')),
});
const db = admin.firestore();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const batchId = process.argv[2];
if (!batchId) {
  console.error('Usage: node undo-import.js <importBatch>');
  process.exit(1);
}

function confirm(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans); }));
}

(async () => {
  const snapshot = await db.collection('books').where('importBatch', '==', batchId).get();

  if (snapshot.empty) {
    console.log(`No books found for batch: ${batchId}`);
    return;
  }

  console.log(`Found ${snapshot.size} book(s) in batch "${batchId}":`);
  snapshot.forEach((doc) => console.log(`  - ${doc.data().title}`));

  const answer = await confirm('\nDelete all of these? This cannot be undone. (yes/no) ');
  if (answer.trim().toLowerCase() !== 'yes') {
    console.log('Cancelled — nothing deleted.');
    return;
  }

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const safeId = data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    try {
      await cloudinary.uploader.destroy(`books/${safeId}`, { resource_type: 'raw' });
    } catch (err) {
      console.warn(`  Cloudinary cleanup failed for "${data.title}":`, err.message);
    }

    await doc.ref.delete();
    console.log(`  deleted: ${data.title}`);
  }

  console.log('\nBatch fully removed.');
})();
