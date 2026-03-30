import fs from 'fs';

export interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  preLabel: string;
  preNum: number;
}

export interface ChangelogEntry {
  versionName: string;
  versionId: string;
  published: string | null;
  link: string;
  isPreview: boolean;
  yearMarker: string | null;
  _versionIdNumeric: number | null;
  _parsed: ParsedVersion;
}

export const REGEX = {
  title: /title:\s*v?([^\n\r]+)/,
  versionId: /\*\s+Version ID:\s*([?\d]+)/i,
  published: /\*\s+Published:\s*(\d{4}-\d{1,2}-\d{1,2})/i,
  semver: /^v?(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z]+)(\d+)?)?/,
  filenameVersion: /^(\d+)-(\d+)-(\d+)(?:p(\d+))?$/,
} as const;

export function filenameToTitle(name: string): string | null {
  const m = name.match(REGEX.filenameVersion);
  if (!m) return null;
  return `${m[1]}.${m[2]}.${m[3]}${m[4] ? `-preview${m[4]}` : ''}`;
}

export function getChangelogFiles(changelogsDir: string): string[] {
  return fs.readdirSync(changelogsDir).filter((f) => (f.endsWith('.md') || f.endsWith('.mdx')) && !['home.mdx', 'versions.mdx'].includes(f));
}

export function parseVersion(name: string): ParsedVersion {
  const m = String(name).trim().match(REGEX.semver);
  if (!m) {
    return { major: 0, minor: 0, patch: 0, preLabel: '', preNum: 0 };
  }
  return {
    major: +(m[1] ?? '0'),
    minor: +(m[2] ?? '0'),
    patch: +(m[3] ?? '0'),
    preLabel: m[4] ?? '',
    preNum: m[5] ? +m[5] : 0,
  };
}

export function compareEntries(a: ChangelogEntry, b: ChangelogEntry): number {
  if (a._versionIdNumeric != null && b._versionIdNumeric != null) {
    return b._versionIdNumeric - a._versionIdNumeric;
  }
  const va = a._parsed;
  const vb = b._parsed;
  for (const key of ['major', 'minor', 'patch'] as const) {
    if (va[key] !== vb[key]) return vb[key] - va[key];
  }
  if (!va.preLabel && vb.preLabel) return -1;
  if (va.preLabel && !vb.preLabel) return 1;
  if (va.preLabel !== vb.preLabel) {
    return vb.preLabel.localeCompare(va.preLabel);
  }
  if (va.preNum !== vb.preNum) return vb.preNum - va.preNum;
  return (b._versionIdNumeric != null ? 1 : 0) - (a._versionIdNumeric != null ? 1 : 0);
}
