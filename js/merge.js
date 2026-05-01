const formatBytes = (bytes) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

const createItem = ({ id, file }, index) => {
  const item = document.createElement("li");
  item.className = "file-card";
  item.setAttribute("draggable", "true");
  item.dataset.id = id;

  item.innerHTML = `
    <div class="file-order">${index + 1}</div>
    <div class="file-info">
      <h4>${file.name}</h4>
      <span>${formatBytes(file.size)}</span>
    </div>
    <button class="drag-handle" type="button" aria-label="Drag to reorder">::</button>
    <button class="remove" type="button" aria-label="Remove file">Remove</button>
  `;

  return item;
};

const initFileList = ({ listElement, onRemove, onReorder }) => {
  const state = {
    files: [],
    mergedUrl: null,
  };

  const revokeMerged = () => {
    if (state.mergedUrl) {
      URL.revokeObjectURL(state.mergedUrl);
      state.mergedUrl = null;
    }
  };

  const render = () => {
    listElement.innerHTML = "";
    if (!state.files.length) {
      const empty = document.createElement("li");
      empty.className = "empty-state";
      empty.textContent = "No PDFs yet. Drop files above to begin.";
      listElement.appendChild(empty);
      return;
    }

    state.files.forEach((entry, index) => {
      const item = createItem(entry, index);
      item.querySelector(".remove").addEventListener("click", () => {
        remove(entry.id);
        onRemove?.();
      });
      listElement.appendChild(item);
    });
  };

  const addFiles = (files) => {
    files.forEach((file) => {
      state.files.push({ id: crypto.randomUUID(), file });
    });
    render();
  };

  const remove = (id) => {
    const index = state.files.findIndex((entry) => entry.id === id);
    if (index >= 0) {
      state.files.splice(index, 1);
      revokeMerged();
      render();
    }
  };

  const clear = () => {
    state.files.splice(0, state.files.length);
    revokeMerged();
    render();
  };

  const totalSize = () => state.files.reduce((sum, entry) => sum + entry.file.size, 0);

  const cacheMergedUrl = (url) => {
    revokeMerged();
    state.mergedUrl = url;
  };

  const reorder = (dragId, dropId) => {
    const dragIndex = state.files.findIndex((entry) => entry.id === dragId);
    const dropIndex = state.files.findIndex((entry) => entry.id === dropId);
    if (dragIndex < 0 || dropIndex < 0 || dragIndex === dropIndex) return;

    const [moved] = state.files.splice(dragIndex, 1);
    state.files.splice(dropIndex, 0, moved);
    render();
    onReorder?.();
  };

  listElement.addEventListener("dragstart", (event) => {
    const target = event.target.closest(".file-card");
    if (!target) return;
    target.classList.add("dragging");
    event.dataTransfer?.setData("text/plain", target.dataset.id);
  });

  listElement.addEventListener("dragend", (event) => {
    const target = event.target.closest(".file-card");
    if (target) target.classList.remove("dragging");
  });

  listElement.addEventListener("dragover", (event) => {
    event.preventDefault();
    const target = event.target.closest(".file-card");
    if (target) target.classList.add("drag-over");
  });

  listElement.addEventListener("dragleave", (event) => {
    const target = event.target.closest(".file-card");
    if (target) target.classList.remove("drag-over");
  });

  listElement.addEventListener("drop", (event) => {
    event.preventDefault();
    const dropTarget = event.target.closest(".file-card");
    if (!dropTarget) return;
    dropTarget.classList.remove("drag-over");
    const dragId = event.dataTransfer?.getData("text/plain");
    if (!dragId) return;
    reorder(dragId, dropTarget.dataset.id);
  });

  render();

  return {
    files: state.files,
    addFiles,
    clear,
    totalSize,
    cacheMergedUrl,
  };
};

const mergePdfFiles = async (entries, { onProgress } = {}) => {
  if (!window.PDFLib?.PDFDocument) {
    throw new Error("PDF library failed to load.");
  }

  const mergedPdf = await window.PDFLib.PDFDocument.create();
  const total = entries.length;

  for (let i = 0; i < total; i += 1) {
    const entry = entries[i];
    const arrayBuffer = await entry.file.arrayBuffer();

    let sourcePdf;
    try {
      sourcePdf = await window.PDFLib.PDFDocument.load(arrayBuffer);
    } catch (error) {
      throw new Error(`Unable to read ${entry.file.name}. It may be corrupt.`);
    }

    const pages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
    pages.forEach((page) => mergedPdf.addPage(page));

    if (onProgress) {
      onProgress(((i + 1) / total) * 100);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }

  const mergedBytes = await mergedPdf.save();
  const blob = new Blob([mergedBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  return { blob, url };
};

const fileInput = document.getElementById("fileInput");
const pickButtons = document.querySelectorAll("[data-pick-files]");
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

pickButtons.forEach((button) => {
  button.addEventListener("click", () => fileInput.click());
});
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
  const stored = localStorage.getItem("theme") || localStorage.getItem("pdf-theme");
  if (stored) {
    document.documentElement.setAttribute("data-theme", stored);
    localStorage.setItem("theme", stored);
  }
};

const toggleTheme = () => {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
};

if (themeToggle) {
  themeToggle.addEventListener("click", toggleTheme);
  initTheme();
}
