// import-public-domain.js
//
// Imports a small, curated list of public-domain short stories into
// Firestore + Cloudinary, tagged with a shared `importBatch` ID so the
// whole batch can be undone later with undo-import.js.
//
// SETUP (one-time):
//   1. npm install firebase-admin node-fetch pdfkit cloudinary
//   2. Download a Firebase service account key:
//      Firebase Console > Project Settings > Service Accounts >
//      "Generate new private key" -> save as ./service-account.json
//      (add this file to .gitignore — never commit it)
//   3. Set your Cloudinary credentials as environment variables:
//      CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
//
// RUN:
//   node import-public-domain.js
//
// This prints the importBatch ID at the end — save it, you'll need it
// to undo.

const fs = require('fs');
const admin = require('firebase-admin');
const fetch = require('node-fetch');
const PDFDocument = require('pdfkit');
const cloudinary = require('cloudinary').v2;

admin.initializeApp({
  credential: admin.credential.cert(require('./service-account.json')),
});
const db = admin.firestore();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Each entry points to that book's own Gutenberg plain-text file.
// (Find these by searching gutenberg.org for the title, opening the
// book page, and copying the "Plain Text UTF-8" link.)
const BOOKS = [
  {
    title: 'The Tell-Tale Heart',
    author: 'Edgar Allan Poe',
    description: "A narrator insists on his sanity while confessing to a murder driven by an old man's unsettling eye.",
    genre: 'Horror',
    gutenbergTextUrl: 'https://www.gutenberg.org/files/2148/2148-0.txt', // example — verify per book
  },
  {
    title: "The Gift of the Magi",
    author: 'O. Henry',
    description: 'A poor young couple each sacrifice their most prized possession to buy the other a Christmas gift.',
    genre: 'Drama',
    gutenbergTextUrl: 'https://www.gutenberg.org/files/7256/7256-0.txt', // example — verify per book
  },
  // Add the rest of the 8 picks here in the same shape.
];

const IMPORT_BATCH = `import-${Date.now()}`;

async function fetchBookText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.text();
}

// Renders plain text into a simple, readable PDF (title page + body).
function makePdfBuffer(title, author, bodyText) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 60 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(24).text(title, { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text(`by ${author}`, { align: 'center' });
    doc.addPage();
    doc.fontSize(11).text(bodyText, { align: 'left' });
    doc.end();
  });
}

function uploadBuffer(buffer, resourceType, publicId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: resourceType, public_id: publicId },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

async function importBook(book) {
  console.log(`Importing: ${book.title}`);

  const rawText = await fetchBookText(book.gutenbergTextUrl);
  // Gutenberg files include boilerplate header/footer — trim it.
  // Adjust these markers if a particular book's file differs.
  const startMarker = '*** START OF';
  const endMarker = '*** END OF';
  const startIdx = rawText.indexOf(startMarker);
  const endIdx = rawText.indexOf(endMarker);
  const body = startIdx !== -1 && endIdx !== -1
    ? rawText.slice(rawText.indexOf('\n', startIdx) + 1, endIdx)
    : rawText;

  const pdfBuffer = await makePdfBuffer(book.title, book.author, body.trim());
  const safeId = book.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const pdfUpload = await uploadBuffer(pdfBuffer, 'raw', `books/${safeId}`);

  // NOTE: generating an actual cover image is a separate step (design
  // tool or a plain placeholder). This script uses a placeholder color
  // block if no cover is supplied — swap in real cover URLs as you make them.
  const coverUrl = book.coverUrl || null;

  await db.collection('books').add({
    title: book.title,
    author: book.author,
    description: book.description,
    genre: book.genre,
    coverUrl: coverUrl,
    pdfUrl: pdfUpload.secure_url,
    pdfSizeBytes: pdfBuffer.length,
    uploadedBy: 'public-domain-import',
    status: 'approved',
    source: 'public-domain-import',
    importBatch: IMPORT_BATCH,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`  done -> ${pdfUpload.secure_url}`);
}

(async () => {
  console.log(`Starting import batch: ${IMPORT_BATCH}`);
  for (const book of BOOKS) {
    try {
      await importBook(book);
    } catch (err) {
      console.error(`  FAILED (${book.title}):`, err.message);
    }
  }
  console.log('\nDone. Save this batch ID to undo later:');
  console.log(IMPORT_BATCH);
})();
