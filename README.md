# Deskglass

**Open source document preview & converter — right in your browser.**

Deskglass lets you preview PDF and Word documents and convert files between formats, entirely client-side. No files are ever uploaded to a server — everything happens locally in your browser.

🔗 **Live app:** [deskglass.netlify.app](https://deskglass.netlify.app)

---

## Features

### 📄 Document Preview
- View **PDF** files with page navigation and zoom controls
- View **Word (.docx)** documents rendered as formatted HTML
- Open multiple files at once and switch between them
- Nothing leaves your device — files are read and rendered locally

### 🔄 File Converter
- **PDF → Word** — extract text from a PDF and download it as a `.docx` file
- **Word → PDF** — convert a `.docx` document into a downloadable `.pdf`
- **Image Converter** — convert between PNG, JPG, and WEBP formats

### 🌓 More
- Light / dark theme toggle
- Installable as a Progressive Web App (PWA)
- Offline detection with a lock screen when there's no connection

---

## Tech Stack

Deskglass is a static site — plain HTML, CSS, and JavaScript, with a few open-source libraries loaded via CDN:

| Library | Purpose |
|---|---|
| [pdf.js](https://mozilla.github.io/pdf.js/) | Rendering and reading PDF files |
| [mammoth.js](https://github.com/mwilliamson/mammoth.js) | Converting `.docx` to HTML for preview |
| [docx](https://docx.js.org/) | Generating `.docx` files (PDF → Word) |
| [jsPDF](https://github.com/parallax/jsPDF) | Generating `.pdf` files (Word → PDF) |
| [html2canvas](https://html2canvas.hertzen.com/) | Rendering HTML content to an image for PDF export |

No build tools, no frameworks, no backend — just static files.

---

## Project Structure

```
Deskglass-web/
├── index.html          # Main app shell (preview + converter UI)
├── style.css            # All styling, including light/dark themes
├── script.js             # App logic: preview, converter, PWA, offline handling
├── manifest.json        # PWA manifest
├── service-worker.js    # Service worker for offline support
└── icon.svg              # App icon
```

---

## Running Locally

Since this is a static site, you don't need a build step — just serve the folder:

```bash
# Clone the repo
git clone https://github.com/markjuliusgalvez-gif/Deskglass-web.git
cd Deskglass-web

# Serve with any static server, e.g.:
npx serve .
```

Then open the local URL it gives you in your browser.

---

## Deployment

Deskglass is deployed on **Netlify**, connected directly to this GitHub repository. Any push to the `main` branch automatically triggers a new deploy.

---

## Privacy

All file processing (preview and conversion) happens entirely in your browser using JavaScript. No files are uploaded to any server — your documents never leave your device.

---

## License

Open source — free to use, modify, and share.
