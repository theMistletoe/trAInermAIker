import { unzipSync } from 'fflate';

export interface ZipCaps {
  /** Exceeding this throws TOO_MANY_ENTRIES. */
  maxEntries: number;
  /** Exceeding this (sum of uncompressed sizes) throws TOO_LARGE_UNCOMPRESSED. */
  maxTotalUncompressed: number;
  /** Entries larger than this are skipped, not stored. */
  maxFileBytes: number;
  /** Content longer than this is truncated and flagged isTruncated. */
  maxFileChars: number;
  /** Stop storing further files once this many are stored. */
  maxStoredFiles: number;
  /** Stop storing further files once stored content reaches this many chars. */
  maxTotalChars: number;
}

export const DEFAULT_ZIP_CAPS: ZipCaps = {
  maxEntries: 2000,
  maxTotalUncompressed: 50 * 1024 * 1024,
  maxFileBytes: 5 * 1024 * 1024,
  maxFileChars: 64_000,
  maxStoredFiles: 150,
  maxTotalChars: 1_000_000,
};

export interface ExtractedFile {
  /** Normalized relative path. */
  path: string;
  /** Original uncompressed byte size. */
  size: number;
  content: string;
  isTruncated: boolean;
}

export interface ExtractResult {
  files: ExtractedFile[];
  /** Total entries seen in the archive. */
  entryCount: number;
  /** Entries not stored (binary/oversize/excluded/over-cap). */
  skippedCount: number;
}

export type ZipExtractReason =
  | 'CORRUPT'
  | 'TOO_MANY_ENTRIES'
  | 'TOO_LARGE_UNCOMPRESSED'
  | 'NO_TEXT_FILES';

export class ZipExtractError extends Error {
  constructor(public reason: ZipExtractReason) {
    super(reason);
    this.name = 'ZipExtractError';
  }
}

const EXCLUDED_SEGMENTS = new Set([
  'node_modules',
  '.git',
  'cdk.out',
  'dist',
  'build',
  'coverage',
  '__MACOSX',
]);

const EXCLUDED_FILENAMES = new Set(['.DS_Store']);

const TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.txt',
  '.yml',
  '.yaml',
  '.toml',
  '.html',
  '.css',
  '.sh',
  '.gitignore',
  '.npmignore',
  '.example',
]);

const TEXT_FILENAMES = new Set(['Dockerfile', 'Makefile']);

const BINARY_SNIFF_BYTES = 1024;

/**
 * Returns the safe relative form of a zip entry path, or null when the entry
 * must be dropped (absolute path, Windows drive prefix, or `..` traversal).
 */
function normalizePath(raw: string): string | null {
  const slashed = raw.replace(/\\/g, '/');
  if (slashed.startsWith('/') || /^[a-zA-Z]:/.test(slashed)) return null;
  const segments = slashed.split('/').filter((s) => s !== '' && s !== '.');
  if (segments.length === 0) return null;
  if (segments.includes('..')) return null;
  return segments.join('/');
}

function isAllowedTextName(filename: string): boolean {
  if (TEXT_FILENAMES.has(filename)) return true;
  const dot = filename.lastIndexOf('.');
  if (dot === -1) return false;
  return TEXT_EXTENSIONS.has(filename.slice(dot).toLowerCase());
}

function sniffsBinary(data: Uint8Array): boolean {
  const limit = Math.min(data.length, BINARY_SNIFF_BYTES);
  for (let i = 0; i < limit; i++) {
    if (data[i] === 0) return true;
  }
  return false;
}

export function extractTextFiles(bytes: Uint8Array, caps?: Partial<ZipCaps>): ExtractResult {
  const limits: ZipCaps = { ...DEFAULT_ZIP_CAPS, ...caps };

  let entryCount = 0;
  let totalUncompressed = 0;
  // Entries rejected by the unzip filter never appear in the output record,
  // so their skips are tallied here instead of in the main loop.
  let skippedCount = 0;

  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes, {
      // The filter sees central-directory metadata before decompression, so
      // archive-level caps reject zip bombs without inflating their payload.
      filter: (info) => {
        entryCount += 1;
        if (entryCount > limits.maxEntries) throw new ZipExtractError('TOO_MANY_ENTRIES');
        totalUncompressed += info.originalSize;
        if (totalUncompressed > limits.maxTotalUncompressed) {
          throw new ZipExtractError('TOO_LARGE_UNCOMPRESSED');
        }
        if (info.originalSize > limits.maxFileBytes) {
          skippedCount += 1;
          return false;
        }
        return true;
      },
    });
  } catch (err) {
    if (err instanceof ZipExtractError) throw err;
    throw new ZipExtractError('CORRUPT');
  }

  const decoder = new TextDecoder();
  const files: ExtractedFile[] = [];
  let totalChars = 0;

  // Sorted raw names make cap-limited selection deterministic as well.
  for (const name of Object.keys(entries).sort()) {
    const data = entries[name];
    if (data === undefined) continue;
    if (name.endsWith('/')) {
      skippedCount += 1;
      continue;
    }
    const path = normalizePath(name);
    if (path === null) {
      skippedCount += 1;
      continue;
    }
    const segments = path.split('/');
    const filename = segments[segments.length - 1] ?? '';
    if (
      segments.some((s) => EXCLUDED_SEGMENTS.has(s)) ||
      EXCLUDED_FILENAMES.has(filename) ||
      data.length > limits.maxFileBytes ||
      !isAllowedTextName(filename) ||
      sniffsBinary(data)
    ) {
      skippedCount += 1;
      continue;
    }
    if (files.length >= limits.maxStoredFiles || totalChars >= limits.maxTotalChars) {
      skippedCount += 1;
      continue;
    }
    let content = decoder.decode(data);
    let isTruncated = false;
    if (content.length > limits.maxFileChars) {
      content = content.slice(0, limits.maxFileChars);
      isTruncated = true;
    }
    totalChars += content.length;
    files.push({ path, size: data.length, content, isTruncated });
  }

  if (files.length === 0) throw new ZipExtractError('NO_TEXT_FILES');

  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { files, entryCount, skippedCount };
}
