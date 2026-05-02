(() => {
  const inputEl = document.getElementById("compressInput");
  if (!inputEl) return;

  const dropZone = document.getElementById("compressDropZone");
  const qualityEl = document.getElementById("compressQuality");
  const qualityValue = document.getElementById("compressQualityValue");
  const widthEl = document.getElementById("compressWidth");
  const heightEl = document.getElementById("compressHeight");
  const formatEl = document.getElementById("compressFormat");
  const selectBtn = document.getElementById("selectCompressBtn");
  const actionBtn = document.getElementById("compressBtn");
  const clearBtn = document.getElementById("clearCompressBtn");
  const statusEl = document.getElementById("compressStatus");
  const progressEl = document.getElementById("compressProgress");
  const progressFill = document.getElementById("compressFill");
  const progressText = document.getElementById("compressText");
  const resultsList = document.getElementById("compressResults");
  const countEl = document.getElementById("compressCount");
  const loadingEl = document.getElementById("compressLoading");
  const themeToggle = document.getElementById("themeToggle");
  const toggleIcon = themeToggle?.querySelector(".toggle-icon");

  const state = {
    files: [],
    results: [],
  };

  const formatBytes = (bytes) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const setStatus = (message, tone = "") => {
    statusEl.textContent = message;
    statusEl.className = `compress-status ${tone}`.trim();
  };

  const setCount = () => {
    const total = state.results.length;
    countEl.textContent = `${total} file${total === 1 ? "" : "s"}`;
  };

  const showProgress = (percent) => {
    progressEl.removeAttribute("aria-hidden");
    progressFill.style.width = `${percent}%`;
    progressText.textContent = `${Math.round(percent)}%`;
  };

  const resetProgress = () => {
    progressEl.setAttribute("aria-hidden", "true");
    progressFill.style.width = "0%";
    progressText.textContent = "0%";
  };

  const setLoading = (isLoading) => {
    loadingEl.hidden = !isLoading;
    actionBtn.disabled = isLoading;
    actionBtn.setAttribute("aria-busy", isLoading ? "true" : "false");
  };

  const revokeResults = () => {
    state.results.forEach((entry) => {
      URL.revokeObjectURL(entry.originalUrl);
      URL.revokeObjectURL(entry.compressedUrl);
    });
    state.results = [];
  };

  const renderResults = () => {
    resultsList.innerHTML = "";
    if (!state.results.length) {
      const empty = document.createElement("li");
      empty.className = "compress-empty";
      empty.textContent = "Compressed files will appear here.";
      resultsList.appendChild(empty);
      setCount();
      return;
    }

    state.results.forEach((entry) => {
      const item = document.createElement("li");
      item.className = "compress-result-card";
      item.innerHTML = `
        <div class="compress-result-main">
          <div>
            <h4>${entry.name}</h4>
            <div class="compress-result-meta">
              ${formatBytes(entry.originalSize)} to ${formatBytes(entry.compressedSize)}
              (${entry.reduction}% smaller)
            </div>
          </div>
          <a class="primary" href="${entry.compressedUrl}" download="${entry.name}">Download</a>
        </div>
        <div class="compress-preview">
          <div class="preview-item">
            <img src="${entry.originalUrl}" alt="Original preview" loading="lazy" />
            <span>Before</span>
          </div>
          <div class="preview-item">
            <img src="${entry.compressedUrl}" alt="Compressed preview" loading="lazy" />
            <span>After</span>
          </div>
        </div>
      `;
      resultsList.appendChild(item);
    });
    setCount();
  };

  const loadImage = (file) => {
    if ("createImageBitmap" in window) {
      return createImageBitmap(file);
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error(`Unable to read ${file.name}.`));
      };
      img.src = url;
    });
  };

  const canvasToBlob = (canvas, mime, quality) =>
    new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Compression failed."));
            return;
          }
          resolve(blob);
        },
        mime,
        quality
      );
    });

  const getTargetSize = (image, widthValue, heightValue) => {
    const width = image.width || image.naturalWidth;
    const height = image.height || image.naturalHeight;

    if (widthValue && heightValue) {
      return { width: widthValue, height: heightValue };
    }

    if (widthValue) {
      const ratio = height / width;
      return { width: widthValue, height: Math.round(widthValue * ratio) };
    }

    if (heightValue) {
      const ratio = width / height;
      return { width: Math.round(heightValue * ratio), height: heightValue };
    }

    return { width, height };
  };

  const compressImage = async ({ file, quality, format, widthValue, heightValue }) => {
    const image = await loadImage(file);
    const { width, height } = getTargetSize(image, widthValue, heightValue);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (format === "jpg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(image, 0, 0, width, height);
    if (image.close) image.close();

    let mime = "image/jpeg";
    let ext = "jpg";
    let outputQuality = quality;

    if (format === "webp") {
      mime = "image/webp";
      ext = "webp";
    } else if (format === "png") {
      mime = "image/png";
      ext = "png";
      outputQuality = undefined;
    }

    const blob = await canvasToBlob(canvas, mime, outputQuality);
    const compressedUrl = URL.createObjectURL(blob);
    const originalUrl = URL.createObjectURL(file);

    const baseName = file.name.replace(/\.[^/.]+$/, "") || "image";
    const reduction = Math.max(0, Math.round((1 - blob.size / file.size) * 100));

    return {
      name: `${baseName}.${ext}`,
      originalSize: file.size,
      compressedSize: blob.size,
      reduction,
      originalUrl,
      compressedUrl,
    };
  };

  const validateFiles = (files) => {
    const valid = [];
    const errors = [];

    Array.from(files).forEach((file) => {
      const isImage =
        file.type.startsWith("image/") ||
        /(\.jpe?g|\.png|\.webp)$/i.test(file.name);
      if (!isImage) {
        errors.push(`${file.name} is not a supported image.`);
        return;
      }
      valid.push(file);
    });

    return { valid, errors };
  };

  const addFiles = (files) => {
    const { valid, errors } = validateFiles(files);
    if (errors.length) {
      setStatus(errors[0], "error");
    }
    if (!valid.length) return;

    state.files.push(...valid);
    setStatus(`${valid.length} image(s) ready.`, "success");
  };

  const clearAll = () => {
    state.files = [];
    revokeResults();
    renderResults();
    resetProgress();
    setStatus("Selection cleared.", "info");
  };

  const runCompression = async () => {
    if (!state.files.length) {
      setStatus("Add at least one image to compress.", "error");
      return;
    }

    const qualityValueRaw = Number.parseInt(qualityEl.value, 10);
    const quality = Math.max(0.05, Math.min(1, qualityValueRaw / 100));
    const widthValue = Number.parseInt(widthEl.value, 10) || 0;
    const heightValue = Number.parseInt(heightEl.value, 10) || 0;
    const format = formatEl.value;

    setStatus("Compressing images...", "info");
    setLoading(true);
    revokeResults();
    renderResults();
    resetProgress();

    try {
      const results = [];
      for (let i = 0; i < state.files.length; i += 1) {
        const file = state.files[i];
        const result = await compressImage({
          file,
          quality,
          format,
          widthValue,
          heightValue,
        });
        results.push(result);
        const percent = ((i + 1) / state.files.length) * 100;
        showProgress(percent);
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }

      state.results = results;
      renderResults();
      setStatus("Compression complete.", "success");
    } catch (error) {
      setStatus(error.message || "Unable to compress images.", "error");
    } finally {
      setLoading(false);
    }
  };

  const initTheme = () => {
    const stored = localStorage.getItem("theme") || localStorage.getItem("pdf-theme");
    if (stored) {
      document.documentElement.setAttribute("data-theme", stored);
      localStorage.setItem("theme", stored);
    }
    syncThemeIcon(stored || document.documentElement.getAttribute("data-theme") || "light");
  };

  const toggleTheme = () => {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    syncThemeIcon(next);
  };

  const syncThemeIcon = (theme) => {
    if (!toggleIcon) return;
    const sunIcon =
      '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="M4.93 4.93l1.41 1.41"></path><path d="M17.66 17.66l1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="M4.93 19.07l1.41-1.41"></path><path d="M17.66 6.34l1.41-1.41"></path></svg>';
    const moonIcon =
      '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"></path></svg>';
    toggleIcon.innerHTML = theme === "dark" ? sunIcon : moonIcon;
  };

  qualityEl.addEventListener("input", (event) => {
    qualityValue.textContent = `${event.target.value}%`;
  });

  actionBtn.addEventListener("click", runCompression);
  clearBtn.addEventListener("click", clearAll);
  selectBtn?.addEventListener("click", () => inputEl.click());

  inputEl.addEventListener("change", (event) => {
    if (event.target.files?.length) {
      addFiles(event.target.files);
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
      addFiles(event.dataTransfer.files);
    }
  });

  if (themeToggle) {
    themeToggle.addEventListener("click", toggleTheme);
    initTheme();
  }

  renderResults();
  resetProgress();
})();
