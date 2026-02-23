const fs = require('fs');
const path = require('path');

const CONFIG = {
  changelogsDir: path.resolve(__dirname, '../content/docs/changelog'),
  outputFile: path.resolve(__dirname, '../data/versions.json'),
};

const REGEX = {
  title: /title:\s*v?([^\n\r]+)/,
  versionId: /\*\s+Version ID:\s*([?\d]+)/i,
  published: /\*\s+Published:\s*(\d{4}-\d{2}-\d{2})/i,
  semver: /^v?(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z]+)(\d+)?)?/,
};

function parseVersion(name) {
  const m = String(name).trim().match(REGEX.semver);
  if (!m) return { major: 0, minor: 0, patch: 0, preLabel: '', preNum: 0 };
  return { major: +m[1], minor: +m[2], patch: +m[3], preLabel: m[4] || '', preNum: m[5] ? +m[5] : 0 };
}

function compareEntries(a, b) {
  if (a._versionIdNumeric != null && b._versionIdNumeric != null) return b._versionIdNumeric - a._versionIdNumeric;
  const va = a._parsed,
    vb = b._parsed;
  if (va.major !== vb.major) return vb.major - va.major;
  if (va.minor !== vb.minor) return vb.minor - va.minor;
  if (va.patch !== vb.patch) return vb.patch - va.patch;
  if (!va.preLabel && vb.preLabel) return -1;
  if (va.preLabel && !vb.preLabel) return 1;
  if (va.preLabel !== vb.preLabel) return vb.preLabel.localeCompare(va.preLabel);
  if (va.preNum !== vb.preNum) return vb.preNum - va.preNum;
  if (a._versionIdNumeric != null) return -1;
  if (b._versionIdNumeric != null) return 1;
  return 0;
}

const readChangelogFiles = () => {
  const entries = fs
    .readdirSync(CONFIG.changelogsDir)
    .filter((f) => f.endsWith('.md') || f.endsWith('.mdx'))
    .map((filename) => {
      const content = fs.readFileSync(path.join(CONFIG.changelogsDir, filename), 'utf8');
      const title = content.match(REGEX.title)?.[1]?.trim();
      const versionIdRaw = content.match(REGEX.versionId)?.[1]?.trim() ?? null;
      const versionIdNumeric = /^\d+$/.test(versionIdRaw) ? parseInt(versionIdRaw, 10) : null;
      const versionName = title || filename.replace(/\.mdx?$/, '');
      return {
        versionName,
        versionId: versionIdRaw ?? '???',
        published: content.match(REGEX.published)?.[1] ?? null,
        link: `/csp-logs/changelog/${filename.replace(/\.mdx?$/, '')}`,
        isPreview: versionName.includes('-preview'),
        yearMarker: null,
        _versionIdNumeric: versionIdNumeric,
        _parsed: parseVersion(versionName),
      };
    })
    .sort(compareEntries);

  const seenYears = new Set();
  for (let i = entries.length - 1; i >= 0; i--) {
    const year = entries[i].published?.slice(0, 4);
    if (year && !seenYears.has(year)) {
      seenYears.add(year);
      entries[i].yearMarker = year;
    }
  }

  return entries;
};

const groupByRelease = (entries) => {
  const groups = [];
  let current = [];
  for (const entry of entries) {
    current.push(entry);
    if (!entry.isPreview) {
      groups.push(current);
      current = [];
    }
  }
  if (current.length) groups.push(current);
  return groups;
};

const main = () => {
  try {
    const entries = readChangelogFiles();
    if (!entries.length) return console.warn('No valid entries.');

    const groups = groupByRelease(entries);
    const previews = entries.filter((e) => e.isPreview).length;

    const output = {
      counts: { total: entries.length, previews, releases: entries.length - previews },
      groups: groups.map((groupEntries) => groupEntries.map(({ _versionIdNumeric, _parsed, ...entry }) => entry)),
    };

    fs.mkdirSync(path.dirname(CONFIG.outputFile), { recursive: true });
    fs.writeFileSync(CONFIG.outputFile, JSON.stringify(output, null, 2));
    console.log(`Generated versions.json with ${entries.length} versions across ${groups.length} groups.`);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
};

main();
