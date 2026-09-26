# ምእራፍ (Merafe)

**A home for short stories — Ethiopian tales and beyond.**

Merafe is a simple, community-driven platform where writers can upload short stories and readers can browse, search, and download them. Built as a solo full-stack project, from concept to deployment.

🔗 **Live site:** [merafe-stories.netlify.app](https://merafe-stories.netlify.app/)

![Merafe preview](assets/og-image.png)

---

## ✨ Features

- 📚 Browse and search short stories by title
- ⬆️ Upload your own stories (PDF + cover image) with genre tagging
- ✅ Admin approval flow — every upload is reviewed before going public
- 🔐 Firebase Authentication (sign up, log in, email verification, password reset)
- 🌗 Light / dark theme, synced across the whole site
- 📱 Fully responsive, mobile-first design
- 🛡️ Duplicate detection (title, cover, and file-hash based)
- ⚡ Client-side image compression before upload for faster, lighter uploads

## 🛠️ Tech Stack

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=flat&logo=firebase&logoColor=black)
![Cloudinary](https://img.shields.io/badge/Cloudinary-3448C5?style=flat&logo=cloudinary&logoColor=white)
![Netlify](https://img.shields.io/badge/Netlify-00C7B7?style=flat&logo=netlify&logoColor=white)

- **Frontend:** Vanilla HTML, CSS, JavaScript (no framework)
- **Auth & Database:** Firebase Authentication + Firestore
- **File storage:** Cloudinary (cover images + PDFs)
- **Hosting:** Netlify

## 🚀 Getting Started

Clone the repo and open it locally:

```bash
git clone https://github.com/kaleb2343/merafe-stories.git
cd merafe-stories
```

Since this project uses Firebase, you'll need to create your own `firebase-config.js` with your own Firebase project credentials to run it locally with full functionality (auth, uploads, database).

Open `index.html` in a live server (e.g. VS Code's Live Server extension) — that's it, no build step required.

## 📸 Screenshots

| ![Home](screenshots/home.png) | ![Book Detail](screenshots/detail.png) | ![Upload](screenshots/upload.png) |

## 🗺️ Roadmap

- [ ] User profile pages with public author bios
- [ ] Comments / reactions on stories
- [ ] Pagination for larger libraries

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 👤 Author

**Kaleb Dawit**
- GitHub: [@kaleb2343](https://github.com/kaleb2343)
- Site: [kalebdawit.vercel.app](https://kalebdawit.vercel.app)