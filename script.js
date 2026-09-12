import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
  function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function optimizeCoverUrl(url) {
    if (!url || !url.includes('/upload/')) return url;
    return url.replace('/upload/', '/upload/f_auto,q_auto,w_600/');
  }

  // Resizes and compresses an image in the browser before it's ever uploaded,
  // so less data actually has to travel over the network. Caps the longest
  // side at 1200px and re-encodes as JPEG at 82% quality, which looks
  // essentially identical for a book cover but is usually 3-10x smaller.
  function compressImage(file, maxDimension = 1200, quality = 0.82) {
    return new Promise((resolve, reject) => {
      // GIFs would lose their animation if we ran them through canvas,
      // so just leave those untouched.
      if (file.type === 'image/gif') {
        resolve(file);
        return;
      }

      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round(height * (maxDimension / width));
            width = maxDimension;
          } else {
            width = Math.round(width * (maxDimension / height));
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl);
            if (!blob) {
              resolve(file); // fall back to the original if compression fails
              return;
            }
            resolve(blob);
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(file); // fall back to the original if it can't be read
      };

      img.src = objectUrl;
    });
  }

  // --- Theme Toggle Functionality ---
  const themeToggle = document.getElementById('theme-toggle');
  const body = document.body;

  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    body.classList.add(savedTheme);
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      if (body.classList.contains('dark-theme')) {
        body.classList.remove('dark-theme');
        localStorage.setItem('theme', '');
      } else {
        body.classList.add('dark-theme');
        localStorage.setItem('theme', 'dark-theme');
      }
    });
  }

  const isTouchDevice = window.matchMedia('(hover: none)').matches;

  // --- Auth Modal (Sign Up / Login / Forgot Password) ---
  const accountBtn = document.getElementById('account-btn');
  const accountMenu = document.getElementById('account-menu');
  const accountMenuName = document.getElementById('account-menu-name');
  const logoutBtn = document.getElementById('logout-btn');
  const authModal = document.getElementById('auth-modal');
  const closeAuthModal = document.getElementById('close-auth-modal');
  const authForm = document.getElementById('auth-form');
  const authTitle = document.getElementById('auth-title');
  const authName = document.getElementById('auth-name');
  const nameLabel = document.getElementById('name-label');
  const authEmail = document.getElementById('auth-email');
  const authPassword = document.getElementById('auth-password');
  const authPasswordConfirm = document.getElementById('auth-password-confirm');
  const confirmLabel = document.getElementById('confirm-label');
  const authError = document.getElementById('auth-error');
  const authSuccess = document.getElementById('auth-success');
  const authSubmitBtn = document.getElementById('auth-submit-btn');
  const authSwitchText = document.getElementById('auth-switch-text');
  const authSwitchBtn = document.getElementById('auth-switch-btn');
  const forgotPasswordBtn = document.getElementById('forgot-password-btn');
  const recaptchaWrapper = document.getElementById('recaptcha-wrapper');

  let isSignUpMode = true;
  let currentUser = null;

  function clearMessages() {
    authError.textContent = '';
    authSuccess.textContent = '';
  }

  function resetToSignUpView() {
    isSignUpMode = true;
    authTitle.textContent = 'Sign Up';
    authSubmitBtn.textContent = 'Sign Up';
    authSwitchText.textContent = 'Already have an account?';
    authSwitchBtn.textContent = 'Log In';
    authPasswordConfirm.style.display = '';
    confirmLabel.style.display = '';
    authPasswordConfirm.required = true;
    authName.style.display = '';
    nameLabel.style.display = '';
    authName.required = true;
    recaptchaWrapper.classList.remove('hidden');
  }

  accountBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (currentUser) {
      accountMenu.classList.toggle('hidden');
    } else {
      authModal.classList.remove('hidden');
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.account-wrapper')) {
      accountMenu.classList.add('hidden');
    }
  });

  logoutBtn.addEventListener('click', () => {
    signOut(auth);
    accountMenu.classList.add('hidden');
  });

  closeAuthModal.addEventListener('click', () => {
    authModal.classList.add('hidden');
    clearMessages();
  });

  authModal.addEventListener('click', (e) => {
    if (e.target === authModal) {
      authModal.classList.add('hidden');
      clearMessages();
    }
  });

  authSwitchBtn.addEventListener('click', () => {
    isSignUpMode = !isSignUpMode;
    clearMessages();
    if (isSignUpMode) {
      authTitle.textContent = 'Sign Up';
      authSubmitBtn.textContent = 'Sign Up';
      authSwitchText.textContent = 'Already have an account?';
      authSwitchBtn.textContent = 'Log In';
      authPasswordConfirm.style.display = '';
      confirmLabel.style.display = '';
      authPasswordConfirm.required = true;
      authName.style.display = '';
      nameLabel.style.display = '';
      authName.required = true;
      recaptchaWrapper.classList.remove('hidden');
    } else {
      authTitle.textContent = 'Log In';
      authSubmitBtn.textContent = 'Log In';
      authSwitchText.textContent = "Don't have an account?";
      authSwitchBtn.textContent = 'Sign Up';
      authPasswordConfirm.style.display = 'none';
      confirmLabel.style.display = 'none';
      authPasswordConfirm.required = false;
      authName.style.display = 'none';
      nameLabel.style.display = 'none';
      authName.required = false;
      recaptchaWrapper.classList.add('hidden');
    }
  });

  forgotPasswordBtn.addEventListener('click', () => {
    clearMessages();
    const email = authEmail.value;
    if (!email) {
      authError.textContent = 'Type your email above first, then click "Forgot password?"';
      return;
    }
    sendPasswordResetEmail(auth, email)
      .then(() => {
        authSuccess.textContent = 'Password reset email sent. Check your inbox.';
      })
      .catch((error) => {
        authError.textContent = friendlyError(error.code);
      });
  });

  authForm.addEventListener('submit', (e) => {
    e.preventDefault();
    clearMessages();

    const name = authName.value;
    const email = authEmail.value;
    const password = authPassword.value;

    if (isSignUpMode) {
      const confirmPassword = authPasswordConfirm.value;
      if (password !== confirmPassword) {
        authError.textContent = "Passwords don't match. Please check and try again.";
        return;
      }
      if (!name.trim()) {
        authError.textContent = 'Please enter your name.';
        return;
      }
      const captchaResponse = typeof grecaptcha !== 'undefined' ? grecaptcha.getResponse() : '';
      if (!captchaResponse) {
        authError.textContent = "Please check the \"I'm not a robot\" box before signing up.";
        return;
      }
    }

    authSubmitBtn.disabled = true;
    authSubmitBtn.textContent = isSignUpMode ? 'Signing up...' : 'Logging in...';

    if (isSignUpMode) {
      let newUser = null;
      createUserWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
          newUser = userCredential.user;
          return updateProfile(newUser, { displayName: name.trim() });
        })
        .then(() => {
          return sendEmailVerification(newUser);
        })
        .then(() => {
          authForm.reset();
          resetToSignUpView();
          authSuccess.textContent = 'Account created! Check your email to verify your account before uploading.';
          setTimeout(() => {
            authModal.classList.add('hidden');
            authSuccess.textContent = '';
          }, 3500);
        })
        .catch((error) => {
          authError.textContent = friendlyError(error.code);
        })
        .finally(() => {
          authSubmitBtn.disabled = false;
          authSubmitBtn.textContent = 'Sign Up';
          if (typeof grecaptcha !== 'undefined') grecaptcha.reset();
        });
    } else {
      signInWithEmailAndPassword(auth, email, password)
        .then(() => {
          authModal.classList.add('hidden');
          authForm.reset();
          resetToSignUpView();
        })
        .catch((error) => {
          authError.textContent = friendlyError(error.code);
        })
        .finally(() => {
          authSubmitBtn.disabled = false;
          authSubmitBtn.textContent = 'Log In';
        });
    }
  });

  function friendlyError(code) {
    if (code === 'auth/email-already-in-use') return 'That email is already registered. Try logging in instead.';
    if (code === 'auth/invalid-email') return 'Please enter a valid email address.';
    if (code === 'auth/weak-password') return 'Password should be at least 6 characters.';
    if (code === 'auth/user-not-found') return 'No account found with that email.';
    if (code === 'auth/wrong-password') return 'Incorrect password.';
    if (code === 'auth/invalid-credential') return 'Incorrect email or password.';
    return 'Something went wrong. Please try again.';
  }

  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
      const displayName = user.displayName || user.email;
      accountBtn.innerHTML = '<i class="fa-solid fa-user-check"></i>';
      accountBtn.setAttribute('aria-label', 'Account menu');
      accountBtn.setAttribute('title', displayName);
      accountMenuName.textContent = displayName;
      body.classList.add('is-logged-in');

      if (user.email === 'eleroidbussines@gmail.com') {
        document.getElementById('admin-btn').classList.remove('hidden');
      } else {
        document.getElementById('admin-btn').classList.add('hidden');
      }
    } else {
      accountBtn.innerHTML = '<i class="fa-solid fa-user-plus"></i>';
      accountBtn.setAttribute('aria-label', 'Account');
      accountBtn.setAttribute('title', '');
      accountMenu.classList.add('hidden');
      body.classList.remove('is-logged-in');
      document.getElementById('admin-btn').classList.add('hidden');
    }
  });

  // --- Upload a Book Feature ---
  const CLOUD_NAME = "qycs1jtu";
  const UPLOAD_PRESET = "merafe_uploads";

  const uploadBtn = document.getElementById('upload-btn');
  const uploadModal = document.getElementById('upload-modal');
  const closeUploadModal = document.getElementById('close-upload-modal');
  const uploadForm = document.getElementById('upload-form');
  const uploadTitle = document.getElementById('upload-title');
  const uploadDesc = document.getElementById('upload-desc');
  const uploadGenre = document.getElementById('upload-genre');
  const uploadCover = document.getElementById('upload-cover');
  const uploadPdf = document.getElementById('upload-pdf');
  const uploadCoverPreview = document.getElementById('upload-cover-preview');
  const uploadCoverFilename = document.getElementById('upload-cover-filename');
  const uploadCoverClear = document.getElementById('upload-cover-clear');
  const uploadPdfPreview = document.getElementById('upload-pdf-preview');
  const uploadPdfFilename = document.getElementById('upload-pdf-filename');
  const uploadPdfClear = document.getElementById('upload-pdf-clear');
  const uploadProgressWrapper = document.getElementById('upload-progress-wrapper');
  const uploadProgressBar = document.getElementById('upload-progress-bar');
  const uploadProgressText = document.getElementById('upload-progress-text');

  // Android Chrome sometimes revokes read access to a picked file if we
  // wait too long before reading it (shows as "permission problems...
  // after a reference to a file was acquired"). The fix: read each file
  // into memory immediately when picked, and use that safe in-memory
  // copy for everything else (compressing, hashing, uploading) instead
  // of touching the original file reference again later.
  let pendingCoverBlob = null;
  let pendingCoverType = '';
  let pendingCoverSize = 0;
  let pendingCoverReadPromise = null;

  let pendingPdfBlob = null;
  let pendingPdfType = '';
  let pendingPdfSize = 0;
  let pendingPdfReadPromise = null;

  uploadCover.addEventListener('change', () => {
    const file = uploadCover.files[0];
    if (!file) {
      uploadCoverPreview.classList.add('hidden');
      pendingCoverBlob = null;
      return;
    }
    uploadCoverFilename.textContent = file.name;
    uploadCoverPreview.classList.remove('hidden');
    pendingCoverType = file.type;
    pendingCoverSize = file.size;
    pendingCoverReadPromise = file.arrayBuffer()
      .then((buf) => {
        pendingCoverBlob = new Blob([buf], { type: file.type });
      })
      .catch((err) => {
        console.error('Could not read cover image right away:', err);
        pendingCoverBlob = null;
      });
  });

  uploadCoverClear.addEventListener('click', () => {
    uploadCover.value = '';
    uploadCoverPreview.classList.add('hidden');
    pendingCoverBlob = null;
  });

  uploadPdf.addEventListener('change', () => {
    const file = uploadPdf.files[0];
    if (!file) {
      uploadPdfPreview.classList.add('hidden');
      pendingPdfBlob = null;
      return;
    }
    uploadPdfFilename.textContent = file.name;
    uploadPdfPreview.classList.remove('hidden');
    pendingPdfType = file.type;
    pendingPdfSize = file.size;
    pendingPdfReadPromise = file.arrayBuffer()
      .then((buf) => {
        pendingPdfBlob = new Blob([buf], { type: file.type });
      })
      .catch((err) => {
        console.error('Could not read PDF right away:', err);
        pendingPdfBlob = null;
      });
  });

  uploadPdfClear.addEventListener('click', () => {
    uploadPdf.value = '';
    uploadPdfPreview.classList.add('hidden');
    pendingPdfBlob = null;
  });

  const uploadError = document.getElementById('upload-error');
  const uploadSuccess = document.getElementById('upload-success');
  const uploadSubmitBtn = document.getElementById('upload-submit-btn');
  const bookGrid = document.getElementById('book-grid');

  uploadBtn.addEventListener('click', async () => {
    if (!currentUser) {
      authModal.classList.remove('hidden');
      return;
    }

    await currentUser.reload();
    await currentUser.getIdToken(true);

    if (!currentUser.emailVerified) {
      const wantsResend = confirm(
        "Please verify your email before uploading. Check your inbox for the verification link.\n\nClick OK to resend the verification email, or Cancel to close this."
      );
      if (wantsResend) {
        sendEmailVerification(currentUser)
          .then(() => alert('Verification email sent! Check your inbox.'))
          .catch(() => alert('Could not send the email right now. Please try again shortly.'));
      }
      return;
    }
    uploadModal.classList.remove('hidden');
  });

  const uploadSuccessView = document.getElementById('upload-success-view');
  const uploadSuccessDoneBtn = document.getElementById('upload-success-done-btn');

  function resetUploadModalView() {
    uploadForm.classList.remove('hidden');
    uploadSuccessView.classList.add('hidden');
    uploadError.textContent = '';
    uploadSuccess.textContent = '';
    uploadProgressWrapper.classList.add('hidden');
    uploadProgressBar.style.width = '0%';
    uploadProgressText.textContent = '0%';
  }

  closeUploadModal.addEventListener('click', () => {
    uploadModal.classList.add('hidden');
    resetUploadModalView();
  });

  uploadSuccessDoneBtn.addEventListener('click', () => {
    uploadModal.classList.add('hidden');
    resetUploadModalView();
  });

  uploadModal.addEventListener('click', (e) => {
    if (e.target === uploadModal) {
      uploadModal.classList.add('hidden');
      resetUploadModalView();
    }
  });

  // Uploads a file to Cloudinary using XMLHttpRequest instead of fetch,
  // specifically because XHR can report real upload progress as the file
  // travels — fetch cannot. onProgress is called repeatedly with the
  // number of bytes sent so far.
  function uploadToCloudinaryWithProgress(file, onProgress) {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', UPLOAD_PRESET);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`);

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          onProgress(event.loaded);
        }
      });

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const data = JSON.parse(xhr.responseText);
          resolve(data.secure_url);
        } else {
          reject(new Error('File upload failed'));
        }
      };

      xhr.onerror = () => reject(new Error('File upload failed'));
      xhr.send(formData);
    });
  }

  async function hashFile(file) {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async function findDuplicateBook(titleLower, coverHash, pdfHash, userId) {
    const titleQuery = query(
      collection(db, 'books'),
      where('titleLower', '==', titleLower),
      where('uploadedBy', '==', userId)
    );
    const coverQuery = query(collection(db, 'books'), where('coverHash', '==', coverHash));
    const pdfQuery = query(collection(db, 'books'), where('pdfHash', '==', pdfHash));

    const [titleSnapshot, coverSnapshot, pdfSnapshot] = await Promise.all([
      getDocs(titleQuery),
      getDocs(coverQuery),
      getDocs(pdfQuery)
    ]);

    if (!titleSnapshot.empty) return 'title';
    if (!coverSnapshot.empty) return 'cover';
    if (!pdfSnapshot.empty) return 'pdf';

    return null;
  }

  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    uploadError.textContent = '';
    uploadSuccess.textContent = '';

    if (!currentUser) {
      uploadError.textContent = 'Please log in first.';
      return;
    }

    if (!currentUser.emailVerified) {
      uploadError.textContent = 'Please verify your email before uploading (check your inbox).';
      return;
    }

    const title = uploadTitle.value.trim();
    const description = uploadDesc.value.trim();
    const genre = uploadGenre.value;

    if (!title || !description || !genre || !uploadCover.files[0] || !uploadPdf.files[0]) {
      uploadError.textContent = 'Please fill in every field and choose both files.';
      return;
    }

    // Make sure the immediate background read of each file (started the
    // moment it was picked) has actually finished before we go further.
    uploadSubmitBtn.disabled = true;
    uploadSubmitBtn.textContent = 'Preparing files...';
    if (pendingCoverReadPromise) await pendingCoverReadPromise;
    if (pendingPdfReadPromise) await pendingPdfReadPromise;

    if (!pendingCoverBlob || !pendingPdfBlob) {
      uploadError.textContent = 'One of your files could not be read. Please choose it again and retry.';
      uploadSubmitBtn.disabled = false;
      uploadSubmitBtn.textContent = 'Upload';
      return;
    }

    const coverFile = pendingCoverBlob;
    const pdfFile = pendingPdfBlob;

    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedImageTypes.includes(pendingCoverType)) {
      uploadError.textContent = 'Cover image must be a JPG, PNG, WEBP, or GIF file.';
      uploadSubmitBtn.disabled = false;
      uploadSubmitBtn.textContent = 'Upload';
      return;
    }
    if (pendingPdfType !== 'application/pdf') {
      uploadError.textContent = 'The book file must be a PDF.';
      uploadSubmitBtn.disabled = false;
      uploadSubmitBtn.textContent = 'Upload';
      return;
    }

    const MAX_COVER_SIZE = 5 * 1024 * 1024;
    const MAX_PDF_SIZE = 25 * 1024 * 1024;
    if (pendingCoverSize > MAX_COVER_SIZE) {
      uploadError.textContent = 'Cover image is too large. Please use an image under 5 MB.';
      uploadSubmitBtn.disabled = false;
      uploadSubmitBtn.textContent = 'Upload';
      return;
    }
    if (pendingPdfSize > MAX_PDF_SIZE) {
      uploadError.textContent = 'PDF file is too large. Please use a file under 25 MB.';
      uploadSubmitBtn.disabled = false;
      uploadSubmitBtn.textContent = 'Upload';
      return;
    }

    uploadSubmitBtn.textContent = 'Optimizing image...';

    try {
      // Shrink the cover image before doing anything else with it — this
      // means less data to hash and less data to actually upload.
      const compressedCover = await compressImage(coverFile);

      uploadSubmitBtn.textContent = 'Checking...';

      const titleLower = title.toLowerCase();

      const [coverHash, pdfHash] = await Promise.all([
        hashFile(compressedCover),
        hashFile(pdfFile)
      ]);

      const duplicateType = await findDuplicateBook(titleLower, coverHash, pdfHash, currentUser.uid);
      if (duplicateType === 'title') {
        uploadError.textContent = "You've already uploaded a book with this exact title. Please use a different title.";
        uploadSubmitBtn.disabled = false;
        uploadSubmitBtn.textContent = 'Upload';
        return;
      }
      if (duplicateType === 'cover') {
        uploadError.textContent = 'This exact cover image has already been uploaded. Please use a different cover.';
        uploadSubmitBtn.disabled = false;
        uploadSubmitBtn.textContent = 'Upload';
        return;
      }
      if (duplicateType === 'pdf') {
        uploadError.textContent = 'This exact PDF file has already been uploaded. Please check you\'re not uploading the same book twice.';
        uploadSubmitBtn.disabled = false;
        uploadSubmitBtn.textContent = 'Upload';
        return;
      }

      uploadSubmitBtn.textContent = 'Uploading...';
      uploadProgressWrapper.classList.remove('hidden');

      const totalBytes = compressedCover.size + pdfFile.size;
      let coverLoaded = 0;
      let pdfLoaded = 0;

      function updateProgress() {
        const percent = Math.min(100, Math.round(((coverLoaded + pdfLoaded) / totalBytes) * 100));
        uploadProgressBar.style.width = percent + '%';
        uploadProgressText.textContent = percent + '%';
      }

      const [coverUrl, pdfUrl] = await Promise.all([
        uploadToCloudinaryWithProgress(compressedCover, (loaded) => {
          coverLoaded = loaded;
          updateProgress();
        }),
        uploadToCloudinaryWithProgress(pdfFile, (loaded) => {
          pdfLoaded = loaded;
          updateProgress();
        })
      ]);

      await addDoc(collection(db, 'books'), {
        title: title,
        titleLower: titleLower,
        description: description,
        genre: genre,
        author: currentUser.displayName || currentUser.email,
        coverUrl: coverUrl,
        coverHash: coverHash,
        pdfUrl: pdfUrl,
        pdfHash: pdfHash,
        pdfSizeBytes: pdfFile.size,
        uploadedBy: currentUser.uid,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      uploadForm.reset();
      uploadCoverPreview.classList.add('hidden');
      uploadPdfPreview.classList.add('hidden');
      uploadProgressWrapper.classList.add('hidden');
      uploadForm.classList.add('hidden');
      document.getElementById('upload-success-view').classList.remove('hidden');
      pendingCoverBlob = null;
      pendingPdfBlob = null;

      loadBooksFromDatabase();

    } catch (error) {
      uploadError.textContent = 'Something went wrong. Please try again.';
      console.error(error);
      uploadProgressWrapper.classList.add('hidden');
    } finally {
      uploadSubmitBtn.disabled = false;
      uploadSubmitBtn.textContent = 'Upload';
    }
  });

  async function loadBooksFromDatabase() {
    document.querySelectorAll('.book-card.real-book').forEach((el) => el.remove());

    const booksQuery = query(
      collection(db, 'books'),
      where('status', '==', 'approved')
    );
    const snapshot = await getDocs(booksQuery);

    const books = [];
    snapshot.forEach((docSnap) => {
      books.push({ id: docSnap.id, ...docSnap.data() });
    });

    books.sort((a, b) => {
      const timeA = a.createdAt ? a.createdAt.toMillis() : 0;
      const timeB = b.createdAt ? b.createdAt.toMillis() : 0;
      return timeB - timeA;
    });

    books.forEach((book) => {
      const card = document.createElement('div');
      card.className = 'book-card real-book';

      const safeCoverUrl = escapeHTML(optimizeCoverUrl(book.coverUrl));
      const safePdfUrl = escapeHTML(book.pdfUrl);
      const safeTitle = escapeHTML(book.title);
      const safeDesc = escapeHTML(book.description);
      const safeAuthor = escapeHTML(book.author);
      const safeGenre = escapeHTML(book.genre || '');

      card.innerHTML = `
        <div class="book-cover" data-cover="${safeCoverUrl}" data-pdf="${safePdfUrl}" data-book-id="${book.id}" data-uploaded-by="${book.uploadedBy}" data-genre="${safeGenre}" data-created="${book.createdAt ? book.createdAt.toMillis() : ''}" data-filesize="${book.pdfSizeBytes || ''}" style="background-image: url('${safeCoverUrl}');">
          <div class="book-overlay">
            <p class="overlay-title">${safeTitle}</p>
            <p class="overlay-desc">${safeDesc}</p>
            <p class="overlay-author">by ${safeAuthor}</p>
            <a class="overlay-download" href="${safePdfUrl}" download target="_blank">Download</a>
            <button class="login-to-download-btn overlay-login-btn">Log in to download</button>
          </div>
        </div>
      `;

      bookGrid.appendChild(card);
    });
  }

  loadBooksFromDatabase();

  // --- Admin: Pending Approvals ---
  const ADMIN_EMAIL = 'eleroidbussines@gmail.com';
  const adminBtn = document.getElementById('admin-btn');
  const adminModal = document.getElementById('admin-modal');
  const closeAdminModal = document.getElementById('close-admin-modal');
  const pendingList = document.getElementById('pending-list');

  adminBtn.addEventListener('click', () => {
    adminModal.classList.remove('hidden');
    loadPendingBooks();
  });

  closeAdminModal.addEventListener('click', () => {
    adminModal.classList.add('hidden');
  });

  adminModal.addEventListener('click', (e) => {
    if (e.target === adminModal) {
      adminModal.classList.add('hidden');
    }
  });

  async function loadPendingBooks() {
    pendingList.innerHTML = '<p class="empty-state-small">Loading...</p>';

    const pendingQuery = query(collection(db, 'books'), where('status', '==', 'pending'));
    const snapshot = await getDocs(pendingQuery);

    if (snapshot.empty) {
      pendingList.innerHTML = '<p class="empty-state-small">No pending books right now.</p>';
      return;
    }

    pendingList.innerHTML = '';

    snapshot.forEach((docSnap) => {
      const book = docSnap.data();
      const bookId = docSnap.id;

      const safeCoverUrl = escapeHTML(book.coverUrl.includes('/upload/') ? book.coverUrl.replace('/upload/', '/upload/f_auto,q_auto,w_120/') : book.coverUrl);
      const safeTitle = escapeHTML(book.title);
      const safeDesc = escapeHTML(book.description);
      const safeAuthor = escapeHTML(book.author);

      const item = document.createElement('div');
      item.className = 'pending-item';
      item.innerHTML = `
        <img src="${safeCoverUrl}" alt="${safeTitle}">
        <div class="pending-item-info">
          <p class="pending-item-title">${safeTitle}</p>
          <p class="pending-item-desc">${safeDesc}</p>
          <p class="pending-item-author">by ${safeAuthor}</p>
          <div class="pending-item-actions">
            <button class="pending-approve-btn" data-id="${bookId}">Approve</button>
            <button class="pending-reject-btn" data-id="${bookId}">Reject</button>
          </div>
        </div>
      `;
      pendingList.appendChild(item);
    });

    pendingList.querySelectorAll('.pending-approve-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const bookId = btn.getAttribute('data-id');
        await updateDoc(doc(db, 'books', bookId), { status: 'approved' });
        loadPendingBooks();
        loadBooksFromDatabase();
      });
    });

    pendingList.querySelectorAll('.pending-reject-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const bookId = btn.getAttribute('data-id');
        await deleteDoc(doc(db, 'books', bookId));
        loadPendingBooks();
      });
    });
  }

  // --- Search ---
  const searchBtn = document.getElementById('search-btn');
  const searchInput = document.getElementById('search-input');

  searchBtn.addEventListener('click', () => {
    searchInput.focus();
  });

  searchInput.addEventListener('input', () => {
    filterBooks(searchInput.value);
  });

  function filterBooks(searchText) {
    const text = searchText.trim().toLowerCase();
    const allCards = document.querySelectorAll('.book-card');

    allCards.forEach((card) => {
      const titleEl = card.querySelector('.overlay-title');
      const title = titleEl ? titleEl.textContent.toLowerCase() : '';

      if (title.includes(text)) {
        card.style.display = '';
      } else {
        card.style.display = 'none';
      }
    });
  }

  // --- Home button: refresh the page ---
  const homeBtn = document.getElementById('home-btn');
  homeBtn.addEventListener('click', () => {
    window.location.reload();
  });

  // --- Book Detail "Page" ---
  const bookDetailModal = document.getElementById('book-detail-modal');
  const closeBookDetailModal = document.getElementById('close-book-detail-modal');
  const detailCover = document.getElementById('detail-cover');
  const detailTitle = document.getElementById('detail-title');
  const detailDesc = document.getElementById('detail-desc');
  const detailAuthor = document.getElementById('detail-author');
  const detailGenre = document.getElementById('detail-genre');
  const detailDate = document.getElementById('detail-date');
  const detailFilesize = document.getElementById('detail-filesize');
  const detailDownload = document.getElementById('detail-download');
  const detailDeleteBtn = document.getElementById('detail-delete-btn');
  const detailEditBtn = document.getElementById('detail-edit-btn');
  const detailSaveBtn = document.getElementById('detail-save-btn');
  const editFields = document.getElementById('edit-fields');
  const editTitleInput = document.getElementById('edit-title-input');
  const editDescInput = document.getElementById('edit-desc-input');

  let currentDetailBookId = null;
  let currentDetailIsOwner = false;

  document.addEventListener('click', (e) => {
    const cover = e.target.closest('.book-cover');
    if (!cover) return;

    if (e.target.classList.contains('overlay-download')) return;
    if (e.target.classList.contains('overlay-login-btn')) return;

    const titleEl = cover.querySelector('.overlay-title');
    const descEl = cover.querySelector('.overlay-desc');
    const authorEl = cover.querySelector('.overlay-author');

    detailCover.style.backgroundImage = `url('${cover.getAttribute('data-cover')}')`;
    detailTitle.textContent = titleEl ? titleEl.textContent : '';
    detailDesc.textContent = descEl ? descEl.textContent : '';
    detailAuthor.textContent = authorEl ? authorEl.textContent : '';
    detailDownload.href = cover.getAttribute('data-pdf');

    const genre = cover.getAttribute('data-genre');
    if (genre) {
      detailGenre.textContent = genre;
      detailGenre.classList.remove('hidden');
    } else {
      detailGenre.classList.add('hidden');
    }

    const createdMillis = cover.getAttribute('data-created');
    if (createdMillis) {
      const dateObj = new Date(Number(createdMillis));
      detailDate.textContent = 'Uploaded ' + dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else {
      detailDate.textContent = '';
    }

    const sizeBytes = cover.getAttribute('data-filesize');
    if (sizeBytes) {
      const sizeMB = (Number(sizeBytes) / (1024 * 1024)).toFixed(1);
      detailFilesize.textContent = 'File size: ' + sizeMB + ' MB';
    } else {
      detailFilesize.textContent = '';
    }

    editTitleInput.value = titleEl ? titleEl.textContent : '';
    editDescInput.value = descEl ? descEl.textContent : '';

    const bookId = cover.getAttribute('data-book-id');
    const uploadedBy = cover.getAttribute('data-uploaded-by');
    currentDetailBookId = bookId;
    currentDetailIsOwner = !!(currentUser && bookId && uploadedBy === currentUser.uid);

    editFields.classList.add('hidden');
    detailSaveBtn.classList.add('hidden');
    detailTitle.style.display = '';
    detailDesc.style.display = '';

    if (currentDetailIsOwner) {
      detailDeleteBtn.classList.remove('hidden');
      detailEditBtn.classList.remove('hidden');
    } else {
      detailDeleteBtn.classList.add('hidden');
      detailEditBtn.classList.add('hidden');
    }

    bookDetailModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  });

  function closeDetailPage() {
    bookDetailModal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  closeBookDetailModal.addEventListener('click', closeDetailPage);

  detailEditBtn.addEventListener('click', () => {
    editFields.classList.remove('hidden');
    detailTitle.style.display = 'none';
    detailDesc.style.display = 'none';
    detailEditBtn.classList.add('hidden');
    detailSaveBtn.classList.remove('hidden');
  });

  detailSaveBtn.addEventListener('click', async () => {
    if (!currentDetailBookId || !currentDetailIsOwner) return;

    const newTitle = editTitleInput.value.trim();
    const newDesc = editDescInput.value.trim();

    if (!newTitle || !newDesc) {
      alert('Title and description cannot be empty.');
      return;
    }

    await updateDoc(doc(db, 'books', currentDetailBookId), {
      title: newTitle,
      description: newDesc
    });

    detailTitle.textContent = newTitle;
    detailDesc.textContent = newDesc;
    editFields.classList.add('hidden');
    detailTitle.style.display = '';
    detailDesc.style.display = '';
    detailSaveBtn.classList.add('hidden');
    detailEditBtn.classList.remove('hidden');

    loadBooksFromDatabase();
  });

  detailDeleteBtn.addEventListener('click', async () => {
    if (!currentDetailBookId) return;
    const confirmed = confirm('Delete this book? This cannot be undone.');
    if (!confirmed) return;

    await deleteDoc(doc(db, 'books', currentDetailBookId));
    closeDetailPage();
    loadBooksFromDatabase();
  });

  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('overlay-login-btn')) {
      authModal.classList.remove('hidden');
    }
  });

  const detailLoginPrompt = document.getElementById('detail-login-prompt');
  detailLoginPrompt.addEventListener('click', () => {
    bookDetailModal.classList.add('hidden');
    authModal.classList.remove('hidden');
  });
});