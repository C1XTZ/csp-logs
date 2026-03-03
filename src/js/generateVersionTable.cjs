const fs = require('fs');
const path = require('path');

const CONFIG = {
  changelogsDir: path.resolve(__dirname, '../content/docs'),
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
    .filter((f) => (f.endsWith('.md') || f.endsWith('.mdx')) && !['home.mdx', 'versions.mdx'].includes(f))
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
        link: `/csp-logs/${filename.replace(/\.mdx?$/, '')}`,
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
  console.log('\x1b[36m[Version Table Generator]\x1b[0m');

  const files = fs.readdirSync(CONFIG.changelogsDir).filter((f) => f.endsWith('.md') || f.endsWith('.mdx'));
  const newestSrc = Math.max(...files.map((f) => fs.statSync(path.join(CONFIG.changelogsDir, f)).mtimeMs));
  const outMtime = fs.existsSync(CONFIG.outputFile) ? fs.statSync(CONFIG.outputFile).mtimeMs : 0;
  if (outMtime >= newestSrc) return console.log(`\x1b[1m\x1b[32m  OK\x1b[0m versions.json is up to date`);

  try {
    const entries = readChangelogFiles();
    if (!entries.length) return console.warn('\x1b[1m\x1b[33mWARN\x1b[0m No valid entries.');

    const groups = groupByRelease(entries);
    const previews = entries.filter((e) => e.isPreview).length;

    const output = {
      counts: { total: entries.length, previews, releases: entries.length - previews },
      groups: groups.map((groupEntries) => groupEntries.map(({ _versionIdNumeric, _parsed, ...entry }) => entry)),
    };

    fs.mkdirSync(path.dirname(CONFIG.outputFile), { recursive: true });
    fs.writeFileSync(CONFIG.outputFile, JSON.stringify(output, null, 2));
    console.log(`\x1b[1m\x1b[32m  OK\x1b[0m versions.json → \x1b[1m${entries.length}\x1b[0m versions, \x1b[1m${groups.length}\x1b[0m groups (\x1b[1m${previews}\x1b[0m previews, \x1b[1m${output.counts.releases}\x1b[0m releases)`);
  } catch (err) {
    console.error(`\x1b[1m\x1b[31m ERR\x1b[0m ${err.message}`);
    process.exit(1);
  }
};

main();
