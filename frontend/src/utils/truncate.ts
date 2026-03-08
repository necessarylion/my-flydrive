/**
 * Truncate a file name in the middle, preserving start and extension.
 * e.g. "very_long_file_name_here.pdf" → "very_long_...here.pdf"
 *      "no_extension_long_name" → "no_exten...ng_name"
 */
export function middleTruncate(name: string, maxLen = 30): string {
  if (name.length <= maxLen) return name;

  const dotIndex = name.lastIndexOf('.');
  const hasExt = dotIndex > 0 && dotIndex > name.length - 8; // reasonable extension length

  if (hasExt) {
    const ext = name.slice(dotIndex); // e.g. ".pdf"
    const base = name.slice(0, dotIndex);
    const available = maxLen - ext.length - 3; // 3 for "..."
    if (available < 4) return name.slice(0, maxLen - 3) + '...';
    const front = Math.ceil(available * 0.6);
    const back = available - front;
    return base.slice(0, front) + '...' + base.slice(-back) + ext;
  }

  // No extension
  const available = maxLen - 3;
  const front = Math.ceil(available * 0.6);
  const back = available - front;
  return name.slice(0, front) + '...' + name.slice(-back);
}
