import JSZip from "jszip";
import { saveAs } from "file-saver";

/** Download a single file by fetching as blob (works cross-origin) */
export async function downloadFile(url: string, filename?: string) {
  const res = await fetch(url);
  const blob = await res.blob();
  const name = filename || decodeURIComponent(url.split("/").pop() || "download");
  saveAs(blob, name);
}

/** Download multiple files as a ZIP */
export async function downloadFilesAsZip(
  files: { url: string; filename: string }[],
  zipName: string = "download.zip"
) {
  const zip = new JSZip();

  await Promise.all(
    files.map(async (file) => {
      const res = await fetch(file.url);
      const blob = await res.blob();
      zip.file(file.filename, blob);
    })
  );

  const content = await zip.generateAsync({ type: "blob" });
  saveAs(content, zipName);
}
