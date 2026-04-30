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
    <button class="drag-handle" type="button" aria-label="Drag to reorder">⋮⋮</button>
    <button class="remove" type="button" aria-label="Remove file">Remove</button>
  `;

  return item;
};

export const initFileList = ({ listElement, onRemove, onReorder }) => {
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
