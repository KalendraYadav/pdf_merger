export const mergePdfFiles = async (entries, { onProgress } = {}) => {
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
