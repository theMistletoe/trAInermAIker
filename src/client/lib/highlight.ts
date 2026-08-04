import type { LanguageFn } from 'highlight.js';
import bash from 'highlight.js/lib/languages/bash';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import typescript from 'highlight.js/lib/languages/typescript';
import yaml from 'highlight.js/lib/languages/yaml';
import { createLowlight } from 'lowlight';

/**
 * 登録グラマーは意図的にこの 6 言語へ絞る（bundle サイズと表示対象の釣り合い）。
 * 別名（ts→typescript 等）はここでは register せず、拡張子解決は extToLanguage が担う。
 */
export const HL_LANGUAGES: Record<string, LanguageFn> = {
  typescript,
  javascript,
  json,
  yaml,
  bash,
  markdown,
};

export const lowlight = createLowlight(HL_LANGUAGES);

const EXT_TO_LANGUAGE: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  json: 'json',
  yml: 'yaml',
  yaml: 'yaml',
  sh: 'bash',
  md: 'markdown',
};

export function extToLanguage(path: string): string | null {
  const dot = path.lastIndexOf('.');
  if (dot <= 0 || dot === path.length - 1) return null;
  const ext = path.slice(dot + 1).toLowerCase();
  return EXT_TO_LANGUAGE[ext] ?? null;
}
