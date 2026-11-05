/** Hands a blob to the browser as a download, without a round trip to the server. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  // Revoking in the same tick can cancel the download in Firefox and Safari.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Copies text to the clipboard; false when the browser refuses (no permission, insecure context). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** "rooming list v7.xlsx" → "rooming list v7" (for naming the reports built from it). */
export function baseName(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}
