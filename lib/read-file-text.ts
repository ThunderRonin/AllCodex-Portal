/**
 * Reads a File object as UTF-8 text, wrapping the FileReader callback API in a
 * Promise for easier composition.
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(new Error(reader.error?.message ?? "Failed to read file"));
    reader.readAsText(file);
  });
}
