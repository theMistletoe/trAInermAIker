import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { extractTextFiles, ZipExtractError, type ZipExtractReason } from '../../src/server/lib/zip';

function extractReason(fn: () => unknown): ZipExtractReason | null {
  try {
    fn();
    return null;
  } catch (err) {
    if (err instanceof ZipExtractError) return err.reason;
    throw err;
  }
}

describe('zipテキスト抽出 (extractTextFiles)', () => {
  it('ネストしたディレクトリのテキストファイルをすべて抽出し、パス順にソートする', () => {
    const zip = zipSync({
      'lib/stack.ts': strToU8('export class Stack {}'),
      'bin/app.ts': strToU8('import { Stack } from "../lib/stack";'),
      'README.md': strToU8('# sample'),
      'package.json': strToU8('{"name":"sample"}'),
    });

    const result = extractTextFiles(zip);

    expect(result.entryCount).toBe(4);
    expect(result.skippedCount).toBe(0);
    expect(result.files.map((f) => f.path)).toEqual([
      'README.md',
      'bin/app.ts',
      'lib/stack.ts',
      'package.json',
    ]);
    expect(result.files.every((f) => !f.isTruncated)).toBe(true);
    const readme = result.files[0];
    expect(readme?.content).toBe('# sample');
    expect(readme?.size).toBe(strToU8('# sample').length);
  });

  it('zipとして壊れたバイト列はCORRUPTを投げる', () => {
    expect(extractReason(() => extractTextFiles(new Uint8Array([1, 2, 3])))).toBe('CORRUPT');
  });

  it('パストラバーサルや絶対パスのエントリは捨ててskippedCountに数える', () => {
    const zip = zipSync({
      '../evil.ts': strToU8('evil'),
      '/abs.ts': strToU8('abs'),
      'ok.ts': strToU8('const ok = 1;'),
    });

    const result = extractTextFiles(zip);

    expect(result.entryCount).toBe(3);
    expect(result.skippedCount).toBe(2);
    expect(result.files.map((f) => f.path)).toEqual(['ok.ts']);
    expect(result.files.some((f) => f.path.includes('..'))).toBe(false);
  });

  it('バイナリファイル(.pngとNULを含む.ts)をスキップし、正常な.tsは保持する', () => {
    const zip = zipSync({
      'img.png': new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01, 0x02]),
      'weird.ts': new Uint8Array([0x00, 0x00, 0x61, 0x62]),
      'clean.ts': strToU8('export const clean = true;'),
    });

    const result = extractTextFiles(zip);

    expect(result.entryCount).toBe(3);
    expect(result.skippedCount).toBe(2);
    expect(result.files.map((f) => f.path)).toEqual(['clean.ts']);
  });

  it('除外ディレクトリ(node_modules/cdk.out/.git)配下のエントリをスキップする', () => {
    const zip = zipSync({
      'node_modules/x/index.js': strToU8('module.exports = {};'),
      'cdk.out/manifest.json': strToU8('{"version":"1"}'),
      '.git/config': strToU8('[core]'),
      'src/index.ts': strToU8('export {};'),
    });

    const result = extractTextFiles(zip);

    expect(result.entryCount).toBe(4);
    expect(result.skippedCount).toBe(3);
    expect(result.files.map((f) => f.path)).toEqual(['src/index.ts']);
  });

  it('maxFileCharsを超える内容は切り詰めてisTruncatedを立て、sizeは元のバイト数を保つ', () => {
    const body = 'a'.repeat(300);
    const zip = zipSync({ 'long.md': strToU8(body) });

    const result = extractTextFiles(zip, { maxFileChars: 100 });

    const file = result.files[0];
    expect(file?.isTruncated).toBe(true);
    expect(file?.content).toBe('a'.repeat(100));
    expect(file?.size).toBe(300);
  });

  it('エントリ数がmaxEntriesを超えるとTOO_MANY_ENTRIESを投げる', () => {
    const zip = zipSync({
      'a.ts': strToU8('1'),
      'b.ts': strToU8('2'),
      'c.ts': strToU8('3'),
    });

    expect(extractReason(() => extractTextFiles(zip, { maxEntries: 2 }))).toBe('TOO_MANY_ENTRIES');
  });

  it('展開後合計サイズがmaxTotalUncompressedを超えるとTOO_LARGE_UNCOMPRESSEDを投げる', () => {
    const zip = zipSync({ 'big.txt': strToU8('x'.repeat(1000)) });

    expect(extractReason(() => extractTextFiles(zip, { maxTotalUncompressed: 100 }))).toBe(
      'TOO_LARGE_UNCOMPRESSED',
    );
  });

  it('maxStoredFilesに達したら以降のテキストファイルはスキップ扱いにする(例外は投げない)', () => {
    const zip = zipSync({
      'a.ts': strToU8('const a = 1;'),
      'b.ts': strToU8('const b = 2;'),
    });

    const result = extractTextFiles(zip, { maxStoredFiles: 1 });

    expect(result.files.map((f) => f.path)).toEqual(['a.ts']);
    expect(result.skippedCount).toBe(1);
    expect(result.entryCount).toBe(2);
  });

  it('テキストファイルが1つもないzipはNO_TEXT_FILESを投げる', () => {
    const zip = zipSync({ 'img.png': new Uint8Array([0x89, 0x50, 0x4e, 0x47]) });

    expect(extractReason(() => extractTextFiles(zip))).toBe('NO_TEXT_FILES');
  });

  it('エントリが0件の空zipはNO_TEXT_FILESを投げる', () => {
    const zip = zipSync({});

    expect(extractReason(() => extractTextFiles(zip))).toBe('NO_TEXT_FILES');
  });
});
