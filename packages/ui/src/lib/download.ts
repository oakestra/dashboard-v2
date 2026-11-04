/** Saves `text` as a file through a temporary object URL. */
export function downloadText(filename: string, text: string, type = 'text/plain'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoking synchronously can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Saves `data` as a pretty-printed JSON file. */
export function downloadJson(filename: string, data: unknown): void {
  downloadText(
    filename.endsWith('.json') ? filename : `${filename}.json`,
    JSON.stringify(data, null, 2),
    'application/json',
  );
}
