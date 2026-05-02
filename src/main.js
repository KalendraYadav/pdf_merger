import { initFileList } from "./components/fileList.js";
import { mergePdfFiles } from "./utils/pdfMerge.js";

const fileInput = document.getElementById("fileInput");
const pickFiles = document.getElementById("pickFiles");
const dropZone = document.getElementById("dropZone");
const statusMessage = document.getElementById("statusMessage");
const mergeBtn = document.getElementById("mergeBtn");
const downloadPanel = document.getElementById("downloadPanel");
const downloadLink = document.getElementById("downloadLink");
const outputNameInput = document.getElementById("outputName");
const clearAllBtn = document.getElementById("clearAll");
const progressBar = document.getElementById("progressBar");
const progressFill = document.getElementById("progressFill");
const progressText = document.getElementById("progressText");
const loadingOverlay = document.getElementById("loadingOverlay");
const themeToggle = document.getElementById("themeToggle");

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_TOTAL_BYTES = 400 * 1024 * 1024;

const fileState = initFileList({
  listElement: document.getElementById("fileList"),
  onRemove: () => updateStatus("", ""),
  onReorder: () => updateStatus("Order updated.", "info"),
});

const updateStatus = (message, tone = "") => {
  statusMessage.textContent = message;
  statusMessage.className = `status ${tone}`.trim();
};

const showProgress = (percent) => {
  progressBar.removeAttribute("aria-hidden");
  progressFill.style.width = `${percent}%`;
  progressText.textContent = `${Math.round(percent)}%`;
};

const resetProgress = () => {
  progressBar.setAttribute("aria-hidden", "true");
  progressFill.style.width = "0%";
  progressText.textContent = "0%";
};

const showDownload = (url, filename) => {
  downloadLink.href = url;
  downloadLink.download = filename;
  downloadPanel.hidden = false;
};

const hideDownload = () => {
  downloadPanel.hidden = true;
  downloadLink.href = "#";
};

const sanitizeFilename = (name) => {
  const trimmed = name.trim();
  if (!trimmed) {
    return "merged.pdf";
  }
  return trimmed.toLowerCase().endsWith(".pdf") ? trimmed : `${trimmed}.pdf`;
};

const validateFiles = (files) => {
  const valid = [];
  const errors = [];
  let totalBytes = fileState.totalSize();

  Array.from(files).forEach((file) => {
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      errors.push(`${file.name} is not a PDF.`);
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      errors.push(`${file.name} exceeds 100 MB.`);
      return;
    }
    totalBytes += file.size;
    if (totalBytes > MAX_TOTAL_BYTES) {
      errors.push("Total size exceeds 400 MB.");
      return;
    }
    valid.push(file);
  });

  return { valid, errors };
};

const handleFiles = (files) => {
  const { valid, errors } = validateFiles(files);
  if (errors.length) {
    updateStatus(errors[0], "error");
  }
  if (!valid.length) {
    return;
  }
  hideDownload();
  fileState.addFiles(valid);
  updateStatus(`${valid.length} file(s) added.`, "success");
};

pickFiles.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", (event) => {
  if (event.target.files?.length) {
    handleFiles(event.target.files);
  }
  event.target.value = "";
});

["dragenter", "dragover"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("active");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("active");
  });
});

dropZone.addEventListener("drop", (event) => {
  if (event.dataTransfer?.files?.length) {
    handleFiles(event.dataTransfer.files);
  }
});

clearAllBtn.addEventListener("click", () => {
  fileState.clear();
  hideDownload();
  resetProgress();
  updateStatus("Queue cleared.", "info");
});

mergeBtn.addEventListener("click", async () => {
  if (!fileState.files.length) {
    updateStatus("Add at least one PDF to merge.", "error");
    return;
  }

  const filename = sanitizeFilename(outputNameInput.value || "merged.pdf");
  updateStatus("Merging PDFs...", "info");
  hideDownload();
  resetProgress();
  loadingOverlay.hidden = false;

  try {
    const { blob, url } = await mergePdfFiles(fileState.files, {
      onProgress: (percent) => showProgress(percent),
    });
    showDownload(url, filename);
    updateStatus("Merge complete.", "success");
    fileState.cacheMergedUrl(url, blob);
  } catch (error) {
    updateStatus(error.message || "Unable to merge PDFs.", "error");
  } finally {
    loadingOverlay.hidden = true;
  }
});

const initTheme = () => {
  const stored = localStorage.getItem("pdf-theme");
  if (stored) {
    document.documentElement.setAttribute("data-theme", stored);
  }
};

const toggleTheme = () => {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("pdf-theme", next);
};

themeToggle.addEventListener("click", toggleTheme);
initTheme();

// SaaS Navigation Mobile Helper
document.addEventListener("DOMContentLoaded", () => {
  const dropdownNav = document.querySelector(".nav-dropdown");
  if (dropdownNav) {
    dropdownNav.addEventListener("click", function(e) {
      if (window.innerWidth <= 768) {
        // Toggle logic for mobile since hover does not apply well
        const menu = this.querySelector(".dropdown-menu");
        const isExpanded = this.getAttribute("aria-expanded") === "true";
        this.setAttribute("aria-expanded", !isExpanded);
        
        if (!isExpanded) {
          menu.style.visibility = "visible";
          menu.style.opacity = "1";
          menu.style.transform = "translateY(0)";
        } else {
          menu.style.visibility = "hidden";
          menu.style.opacity = "0";
          menu.style.transform = "translateY(10px)";
        }
      }
    });

    // Close click-outside on mobile
    document.addEventListener("click", (e) => {
      if (window.innerWidth <= 768 && !dropdownNav.contains(e.target)) {
        const menu = dropdownNav.querySelector(".dropdown-menu");
        dropdownNav.setAttribute("aria-expanded", "false");
        if(menu) {
           menu.style.visibility = "hidden";
           menu.style.opacity = "0";
           menu.style.transform = "translateY(10px)";
        }
      }
    });
  }
});

