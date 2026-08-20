if(typeof pdfjsLib !== 'undefined'){
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}
const files = {};
let activeId = null;
let idSeq = 0;
let converterFiles = {
  pdfToWord: null,
  wordToPdf: null,
  image: null
};

/* ========== DOM References ========== */
const fileInput = document.getElementById('fileInput');
const dropzone = document.getElementById('dropzone');
const fileList = document.getElementById('fileList');
const emptyHint = document.getElementById('emptyHint');
const viewport = document.getElementById('viewport');
const toolbar = document.getElementById('toolbar');
const docTitle = document.getElementById('docTitle');
const pdfControls = document.getElementById('pdfControls');
const pageInfo = document.getElementById('pageInfo');
const zoomInfo = document.getElementById('zoomInfo');

/* Loading Screen */
const loadingScreen = document.getElementById('loadingScreen');
const loadingBarFill = document.getElementById('loadingBarFill');

/* Offline Banner */
const offlineBanner = document.getElementById('offlineBanner');
const offlineOverlay = document.getElementById('offlineOverlay');
const retryOnlineBtn = document.getElementById('retryOnlineBtn');

/* PWA Install */
const installBtn = document.getElementById('installBtn');
let deferredPrompt = null;

/* Theme */
const themeToggle = document.getElementById('themeToggle');
const html = document.documentElement;

/* Mode */
const previewModeBtn = document.getElementById('previewModeBtn');
const convertModeBtn = document.getElementById('convertModeBtn');
const previewPane = document.getElementById('previewPane');
const converterPane = document.getElementById('converterPane');
const modeSlider = document.getElementById('modeSlider');

/* Converter Elements */
const pdfToWordInput = document.getElementById('pdfToWordInput');
const pdfToWordDropzone = document.getElementById('pdfToWordDropzone');
const pdfToWordBtn = document.getElementById('pdfToWordBtn');
const wordToPdfInput = document.getElementById('wordToPdfInput');
const wordToPdfDropzone = document.getElementById('wordToPdfDropzone');
const wordToPdfBtn = document.getElementById('wordToPdfBtn');
const imageConverterInput = document.getElementById('imageConverterInput');
const imageConverterDropzone = document.getElementById('imageConverterDropzone');
const imageConverterBtn = document.getElementById('imageConverterBtn');
const imageOptions = document.getElementById('imageOptions');
const imageFormatSelect = document.getElementById('imageFormatSelect');

/* ========== Initialization ========== */

/* ========== Theme Toggle ========== */
themeToggle.addEventListener('click', () => {
  const isDark = html.getAttribute('data-theme') === 'dark';
  if(isDark){
    html.removeAttribute('data-theme');
    localStorage.setItem('deskglass-theme', 'light');
  } else {
    html.setAttribute('data-theme', 'dark');
    localStorage.setItem('deskglass-theme', 'dark');
  }
});

/* ========== Mode Toggle (Preview / Converter) ========== */
function updateModeSlider(){
  if(!modeSlider) return;
  const previewWidth = previewModeBtn.offsetWidth;
  const convertWidth = convertModeBtn.offsetWidth;
  const gap = 4;
  
  if(previewModeBtn.classList.contains('active')){
    modeSlider.style.transform = 'translateX(0)';
    modeSlider.style.width = previewWidth + 'px';
  } else if(convertModeBtn.classList.contains('active')){
    modeSlider.style.transform = 'translateX(' + (previewWidth + gap) + 'px)';
    modeSlider.style.width = convertWidth + 'px';
  }
}

function setMode(mode){
  if(mode === 'preview'){
    previewPane.style.display = 'flex';
    converterPane.style.display = 'none';
    previewModeBtn.classList.add('active');
    convertModeBtn.classList.remove('active');
  } else {
    previewPane.style.display = 'none';
    converterPane.style.display = 'flex';
    previewModeBtn.classList.remove('active');
    convertModeBtn.classList.add('active');
  }
  updateModeSlider();
}
previewModeBtn.addEventListener('click', () => setMode('preview'));
convertModeBtn.addEventListener('click', () => setMode('convert'));

/* ========== File Input / Drag & Drop (Preview) ========== */
dropzone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', e => handleFiles(e.target.files));

['dragenter','dragover'].forEach(evt=>{
  dropzone.addEventListener(evt, e=>{ e.preventDefault(); dropzone.classList.add('drag'); });
});
['dragleave','drop'].forEach(evt=>{
  dropzone.addEventListener(evt, e=>{ e.preventDefault(); dropzone.classList.remove('drag'); });
});
dropzone.addEventListener('drop', e=>{
  if(e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
});

function handleFiles(fileArr){
  Array.from(fileArr).forEach(f=>{
    const ext = f.name.split('.').pop().toLowerCase();
    if(ext !== 'pdf' && ext !== 'docx'){
      addEntry(f, ext, true);
      return;
    }
    addEntry(f, ext, false);
  });
  fileInput.value = '';
}

function addEntry(file, ext, unsupported){
  const id = 'f' + (idSeq++);
  files[id] = { file, ext, unsupported, pdfDoc:null, pageNum:1, scale:1.1 };
  renderFileList();
  setMode('preview');
  openFile(id);
}

function renderFileList(){
  fileList.innerHTML = '';
  const ids = Object.keys(files);
  emptyHint.style.display = ids.length ? 'none' : 'block';
  ids.forEach(id=>{
    const entry = files[id];
    const li = document.createElement('li');
    li.className = 'filetab' + (id === activeId ? ' active' : '');
    const badgeClass = entry.ext === 'pdf' ? 'pdf' : (entry.ext === 'docx' ? 'docx' : 'other');
    const badgeLabel = entry.ext === 'pdf' ? 'PDF' : (entry.ext === 'docx' ? 'DOC' : entry.ext.slice(0,3).toUpperCase());
    li.innerHTML = `
      <div class="badge ${badgeClass}">${badgeLabel}</div>
      <div class="meta">
        <div class="name">${escapeHtml(entry.file.name)}</div>
        <div class="sub">${formatSize(entry.file.size)}</div>
      </div>
      <button class="close" title="Close">&times;</button>
    `;
    li.addEventListener('click', (e)=>{
      if(e.target.closest('.close')) return;
      setMode('preview');
      openFile(id);
    });
    li.querySelector('.close').addEventListener('click', ()=>closeFile(id));
    fileList.appendChild(li);
  });
}

function closeFile(id){
  delete files[id];
  if(activeId === id){
    activeId = null;
    const remaining = Object.keys(files);
    if(remaining.length) openFile(remaining[remaining.length-1]);
    else showEmptyState();
  }
  renderFileList();
}

function showEmptyState(){
  toolbar.style.display = 'none';
  viewport.innerHTML = `
    <div class="placeholder">
      <div class="glyph">&#128196;</div>
      <h3>No document open</h3>
      <p>Add a PDF or Word file on the left to preview it here. Files stay on this page — nothing is uploaded anywhere.</p>
    </div>`;
}

function formatSize(bytes){
  if(bytes < 1024) return bytes + ' B';
  if(bytes < 1024*1024) return (bytes/1024).toFixed(0) + ' KB';
  return (bytes/(1024*1024)).toFixed(1) + ' MB';
}
function escapeHtml(s){
  return s.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

async function openFile(id){
  activeId = id;
  renderFileList();
  const entry = files[id];
  docTitle.textContent = entry.file.name;
  toolbar.style.display = 'flex';

  if(entry.unsupported){
    pdfControls.style.display = 'none';
    viewport.innerHTML = `
      <div class="unsupported">
        <div class="glyph">.${entry.ext.slice(0,4)}</div>
        <h3>Preview not supported</h3>
        <p>Deskglass previews PDF and Word (.docx) files only. This file type can't be rendered here.</p>
      </div>`;
    return;
  }

  viewport.innerHTML = `<div class="loading"><div class="spinner"></div>Opening document…</div>`;

  if(entry.ext === 'pdf'){
    pdfControls.style.display = 'flex';
    await openPdf(entry);
  } else if(entry.ext === 'docx'){
    pdfControls.style.display = 'none';
    await openDocx(entry);
  }
}

async function openPdf(entry){
  try{
    const buf = await entry.file.arrayBuffer();
    const doc = await pdfjsLib.getDocument({data: buf}).promise;
    entry.pdfDoc = doc;
    entry.pageNum = 1;
    viewport.innerHTML = `<div class="page-shell"><canvas id="pdfCanvas"></canvas></div>`;
    await renderPdfPage(entry);
  }catch(err){
    viewport.innerHTML = `<div class="unsupported"><div class="glyph">!</div><h3>Couldn't open PDF</h3><p>${escapeHtml(err.message || 'The file may be corrupted or password protected.')}</p></div>`;
  }
}

async function renderPdfPage(entry){
  const page = await entry.pdfDoc.getPage(entry.pageNum);
  const viewportObj = page.getViewport({scale: entry.scale});
  const canvas = document.getElementById('pdfCanvas');
  const ctx = canvas.getContext('2d');
  canvas.width = viewportObj.width;
  canvas.height = viewportObj.height;
  await page.render({canvasContext: ctx, viewport: viewportObj}).promise;
  pageInfo.textContent = `${entry.pageNum} / ${entry.pdfDoc.numPages}`;
  zoomInfo.textContent = Math.round(entry.scale * 100 / 1.1) + '%';
}

document.getElementById('prevPage').addEventListener('click', async ()=>{
  const entry = files[activeId];
  if(!entry || !entry.pdfDoc || entry.pageNum <= 1) return;
  entry.pageNum--;
  await renderPdfPage(entry);
});
document.getElementById('nextPage').addEventListener('click', async ()=>{
  const entry = files[activeId];
  if(!entry || !entry.pdfDoc || entry.pageNum >= entry.pdfDoc.numPages) return;
  entry.pageNum++;
  await renderPdfPage(entry);
});
document.getElementById('zoomIn').addEventListener('click', async ()=>{
  const entry = files[activeId];
  if(!entry || !entry.pdfDoc) return;
  entry.scale = Math.min(entry.scale + 0.2, 3);
  await renderPdfPage(entry);
});
document.getElementById('zoomOut').addEventListener('click', async ()=>{
  const entry = files[activeId];
  if(!entry || !entry.pdfDoc) return;
  entry.scale = Math.max(entry.scale - 0.2, 0.4);
  await renderPdfPage(entry);
});

async function openDocx(entry){
  try{
    const buf = await entry.file.arrayBuffer();
    const result = await mammoth.convertToHtml({arrayBuffer: buf});
    viewport.innerHTML = `<div class="docbody">${result.value}</div>`;
  }catch(err){
    viewport.innerHTML = `<div class="unsupported"><div class="glyph">!</div><h3>Couldn't open document</h3><p>${escapeHtml(err.message || 'The file may be corrupted.')}</p></div>`;
  }
}

/* ========== Converter: Drag & Drop Setup ========== */
function setupConverterDropzone(dropzoneEl, inputEl, type){
  dropzoneEl.addEventListener('click', () => inputEl.click());
  inputEl.addEventListener('change', e => {
    if(e.target.files.length){
      converterFiles[type] = e.target.files[0];
      dropzoneEl.querySelector('.dropzone-text').textContent = converterFiles[type].name;
      getConvertBtn(type).disabled = false;
    }
  });
  ['dragenter','dragover'].forEach(evt=>{
    dropzoneEl.addEventListener(evt, e=>{ e.preventDefault(); dropzoneEl.classList.add('drag'); });
  });
  ['dragleave','drop'].forEach(evt=>{
    dropzoneEl.addEventListener(evt, e=>{ e.preventDefault(); dropzoneEl.classList.remove('drag'); });
  });
  dropzoneEl.addEventListener('drop', e=>{
    if(e.dataTransfer.files.length){
      converterFiles[type] = e.dataTransfer.files[0];
      dropzoneEl.querySelector('.dropzone-text').textContent = converterFiles[type].name;
      getConvertBtn(type).disabled = false;
    }
  });
}

function getConvertBtn(type){
  switch(type){
    case 'pdfToWord': return pdfToWordBtn;
    case 'wordToPdf': return wordToPdfBtn;
    case 'image': return imageConverterBtn;
  }
}

setupConverterDropzone(pdfToWordDropzone, pdfToWordInput, 'pdfToWord');
setupConverterDropzone(wordToPdfDropzone, wordToPdfInput, 'wordToPdf');
setupConverterDropzone(imageConverterDropzone, imageConverterInput, 'image');

imageConverterInput.addEventListener('change', () => {
  if(converterFiles.image){
    imageOptions.style.display = 'flex';
  }
});

/* ========== Converter: PDF to Word ========== */
pdfToWordBtn.addEventListener('click', async () => {
  const file = converterFiles.pdfToWord;
  if(!file) return;
  const statusEl = document.getElementById('pdfToWordStatus');
  pdfToWordBtn.disabled = true;
  pdfToWordBtn.textContent = 'Converting...';
  statusEl.className = 'converter-status';
  statusEl.textContent = '';
  try{
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({data: buf}).promise;
    const Paragraph = docx.Paragraph;
    const TextRun = docx.TextRun;
    const Document = docx.Document;
    const Packer = docx.Packer;
    const paragraphs = [];
    for(let i = 1; i <= pdf.numPages; i++){
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      let pageText = '';
      content.items.forEach(item => {
        pageText += item.str + ' ';
      });
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: pageText.trim(), break: 1 })]
      }));
    }
    const doc = new Document({
      sections: [{ properties: {}, children: paragraphs }]
    });
    const blob = await Packer.toBlob(doc);
    downloadBlob(blob, file.name.replace(/\.pdf$/i, '') + '.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    statusEl.className = 'converter-status success';
    statusEl.textContent = 'Conversion complete! File downloaded.';
    pdfToWordBtn.textContent = 'Convert';
    pdfToWordBtn.disabled = false;
  }catch(err){
    statusEl.className = 'converter-status error';
    statusEl.textContent = 'Conversion failed: ' + (err.message || 'Unknown error');
    pdfToWordBtn.textContent = 'Convert';
    pdfToWordBtn.disabled = false;
  }
});

/* ========== Converter: Word to PDF ========== */
wordToPdfBtn.addEventListener('click', async () => {
  const file = converterFiles.wordToPdf;
  if(!file) return;
  const statusEl = document.getElementById('wordToPdfStatus');
  wordToPdfBtn.disabled = true;
  wordToPdfBtn.textContent = 'Converting...';
  statusEl.className = 'converter-status';
  statusEl.textContent = '';
  let container = null;
  try{
    const buf = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({arrayBuffer: buf});

    if(typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined'){
      throw new Error('PDF export libraries failed to load. Check your connection and try again.');
    }

    /* Render the document HTML off-screen so it can be captured as an image */
    container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-99999px';
    container.style.top = '0';
    container.style.width = '794px'; /* ~A4 width at 96dpi */
    container.style.padding = '48px';
    container.style.boxSizing = 'border-box';
    container.style.background = '#ffffff';
    container.style.fontFamily = "'Source Serif 4', Georgia, serif";
    container.style.fontSize = '15px';
    container.style.lineHeight = '1.7';
    container.style.color = '#242119';
    container.innerHTML = `
      <style>
        h1,h2,h3,h4{font-family:'Source Serif 4',Georgia,serif;line-height:1.3;margin:0.6em 0 0.3em;}
        p{margin:0 0 0.8em;}
        table{border-collapse:collapse;margin:12px 0;width:100%;}
        td,th{border:1px solid #ccc;padding:6px 10px;font-size:14px;}
        img{max-width:100%;}
      </style>
      ${result.value}
    `;
    document.body.appendChild(container);

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff'
    });

    document.body.removeChild(container);
    container = null;

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while(heightLeft > 0){
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(file.name.replace(/\.docx$/i, '') + '.pdf');

    statusEl.className = 'converter-status success';
    statusEl.textContent = 'Conversion complete! File downloaded.';
    wordToPdfBtn.textContent = 'Convert';
    wordToPdfBtn.disabled = false;
  }catch(err){
    if(container && container.parentNode) container.parentNode.removeChild(container);
    statusEl.className = 'converter-status error';
    statusEl.textContent = 'Conversion failed: ' + (err.message || 'Unknown error');
    wordToPdfBtn.textContent = 'Convert';
    wordToPdfBtn.disabled = false;
  }
});

/* ========== Converter: Image Converter ========== */
imageConverterBtn.addEventListener('click', () => {
  const file = converterFiles.image;
  if(!file) return;
  const format = imageFormatSelect.value;
  const ext = format === 'image/png' ? 'png' : (format === 'image/jpeg' ? 'jpg' : 'webp');
  const statusEl = document.getElementById('imageConverterStatus');
  imageConverterBtn.disabled = true;
  imageConverterBtn.textContent = 'Converting...';
  statusEl.className = 'converter-status';
  statusEl.textContent = '';
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        downloadBlob(blob, file.name.replace(/\.\w+$/i, '') + '.' + ext, format);
        statusEl.className = 'converter-status success';
        statusEl.textContent = 'Conversion complete! File downloaded.';
        imageConverterBtn.textContent = 'Convert';
        imageConverterBtn.disabled = false;
      }, format, 0.92);
    };
    img.onerror = () => {
      statusEl.className = 'converter-status error';
      statusEl.textContent = 'Failed to load image.';
      imageConverterBtn.textContent = 'Convert';
      imageConverterBtn.disabled = false;
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
});

/* ========== Utility: Download Blob ========== */
function downloadBlob(blob, filename, mimeType){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ========== Auth Modal ========== */
const toastContainer = document.getElementById('toastContainer');

/* Toast system */
function showToast(type, title, message, duration = 4000){
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  const iconLetter = type === 'success' ? '✓' : (type === 'error' ? '!' : 'i');
  toast.innerHTML = `
    <div class="toast-icon">${iconLetter}</div>
    <div class="toast-body">
      <div class="toast-title">${escapeHtml(title)}</div>
      <div class="toast-message">${escapeHtml(message)}</div>
    </div>
    <button class="toast-close" aria-label="Close">&times;</button>
  `;
  toastContainer.appendChild(toast);
  const closeBtn = toast.querySelector('.toast-close');
  const remove = () => {
    toast.classList.add('leaving');
    setTimeout(() => {
      if(toast.parentNode) toast.parentNode.removeChild(toast);
    }, 250);
  };
  closeBtn.addEventListener('click', remove);
  const timer = setTimeout(remove, duration);
  toast.addEventListener('mouseenter', () => clearTimeout(timer));
  toast.addEventListener('mouseleave', () => {
    setTimeout(remove, duration);
  });
}

/* PWA Install */
if(installBtn){
  installBtn.addEventListener('click', async () => {
    if(!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if(outcome === 'accepted'){
      showToast('success', 'Installing', 'Deskglass is being installed.');
    }
    deferredPrompt = null;
    installBtn.style.display = 'none';
  });
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if(installBtn){
    installBtn.style.display = 'inline-flex';
  }
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  if(installBtn){
    installBtn.style.display = 'none';
  }
  showToast('success', 'Installed', 'Deskglass has been installed as an app.');
});

/* Offline / Online detection */
let lastOnlineStatus = navigator.onLine;
const interactiveSelectors = 'button, input, select, a, .mode-btn, .theme-toggle, .dropzone, .convert-btn, .filetab';
let interactiveElements = [];

function lockFeatures(){
  if(!offlineOverlay) return;
  offlineOverlay.classList.add('visible');
  document.body.style.overflow = 'hidden';
  interactiveElements = Array.from(document.querySelectorAll(interactiveSelectors));
  interactiveElements.forEach(el => el.setAttribute('disabled', 'disabled'));
}

function unlockFeatures(){
  if(!offlineOverlay) return;
  offlineOverlay.classList.remove('visible');
  document.body.style.overflow = '';
  interactiveElements.forEach(el => el.removeAttribute('disabled'));
  interactiveElements = [];
}

function updateOnlineStatus(){
  const isOnline = navigator.onLine;
  if(offlineBanner){
    if(isOnline){
      offlineBanner.classList.remove('visible');
    } else {
      offlineBanner.classList.add('visible');
    }
  }
  
  if(isOnline){
    unlockFeatures();
    if(!lastOnlineStatus){
      showToast('success', 'Back online', 'Your internet connection has been restored. All features are now available.');
    }
  } else {
    lockFeatures();
    if(lastOnlineStatus){
      showToast('error', 'You are offline', 'Please connect to the internet to access all features.');
    }
  }
  
  lastOnlineStatus = isOnline;
}

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// Fallback: poll online status every 2 seconds
setInterval(updateOnlineStatus, 2000);

if(retryOnlineBtn){
  retryOnlineBtn.addEventListener('click', () => {
    if(navigator.onLine){
      updateOnlineStatus();
    } else {
      showToast('error', 'Still offline', 'Please check your internet connection and try again.');
    }
  });
}

/* ========== Global Error Guard ========== */
window.addEventListener('error', function(e){
  if(e.message && e.message.includes('Cannot access') && loadingScreen){
    loadingScreen.classList.add('hidden');
  }
});

/* ========== Initialization ========== */
(function init(){
  // Theme
  const savedTheme = localStorage.getItem('deskglass-theme');
  if(savedTheme === 'dark'){
    html.setAttribute('data-theme', 'dark');
  }

  // Offline status
  updateOnlineStatus();

  // Loading screen — hide deterministically after minimum display time
  const LOADING_MIN_MS = 1400;
  const startTime = Date.now();

  function hideLoadingScreen(){
    loadingScreen.classList.add('hidden');
  }

  function tryHideLoadingScreen(){
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, LOADING_MIN_MS - elapsed);
    setTimeout(hideLoadingScreen, remaining);
  }

  // Always reset and start the loading bar animation
  loadingBarFill.style.animation = 'none';
  loadingBarFill.offsetHeight;
  loadingBarFill.style.animation = 'loadBar 1.5s ease-in-out forwards';

  // If page is already loaded, hide after minimum time
  if(document.readyState === 'complete'){
    tryHideLoadingScreen();
  } else {
    window.addEventListener('load', tryHideLoadingScreen, { once: true });
  }

  // Hard fallback: always hide after 4 seconds no matter what
  setTimeout(hideLoadingScreen, 4000);

  // Initialize mode slider position after layout
  setTimeout(updateModeSlider, 100);
  window.addEventListener('resize', updateModeSlider);
})();
