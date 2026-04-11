import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { REGEX, getChangelogFiles, parseVersion, compareEntries, type ChangelogEntry } from '../ts/changelogUtils.ts';

interface Config {
  changelogsDir: string;
  outputFile: string;
}

interface VersionOutput {
  hash: string;
  counts: {
    total: number;
    previews: number;
    releases: number;
  };
  groups: Array<Array<Omit<ChangelogEntry, '_versionIdNumeric' | '_parsed'>>>;
}

const CONFIG: Config = {
  changelogsDir: path.resolve(process.cwd(), 'src', 'content', 'docs'),
  outputFile: path.resolve(process.cwd(), 'src', 'data', 'versions.json'),
};

function getSourceHash(files: string[]): string {
  const hash = crypto.createHash('md5');
  for (const f of files) {
    hash.update(fs.readFileSync(path.join(CONFIG.changelogsDir, f)));
  }
  return hash.digest('hex');
}

function readChangelogFiles(): ChangelogEntry[] {
  const entries: ChangelogEntry[] = getChangelogFiles(CONFIG.changelogsDir)
    .map((filename): ChangelogEntry => {
      const content = fs.readFileSync(path.join(CONFIG.changelogsDir, filename), 'utf8');
      const title = content.match(REGEX.title)?.[1]?.trim();
      const versionIdRaw = content.match(REGEX.versionId)?.[1]?.trim() ?? null;
      const versionIdNumeric = versionIdRaw && /^\d+$/.test(versionIdRaw) ? parseInt(versionIdRaw, 10) : null;
      const versionName = title || filename.replace(/\.mdx?$/, '');

      let published = content.match(REGEX.published)?.[1] ?? null;
      if (published) {
        const [y, m, d] = published.split('-');
        if (y && m && d) {
          published = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
      }

      return {
        versionName,
        versionId: versionIdRaw ?? '???',
        published,
        link: `/csp-logs/${filename.replace(/\.mdx?$/, '')}`,
        isPreview: versionName.includes('-preview'),
        yearMarker: null,
        _versionIdNumeric: versionIdNumeric,
        _parsed: parseVersion(versionName),
      };
    })
    .sort(compareEntries);

  placeYearMarkers(entries);

  return entries;
}

function placeYearMarkers(entries: ChangelogEntry[]): void {
  const entryByYear = new Map<string, { index: number; time: number }>();

  entries.forEach((entry, index) => {
    const year = entry.published?.slice(0, 4);
    if (!year) return;

    const time = Date.parse(`${entry.published}T00:00:00Z`);
    if (Number.isNaN(time)) return;

    const current = entryByYear.get(year);
    if (!current || time > current.time) entryByYear.set(year, { index, time });
  });

  entryByYear.forEach(({ index }, year) => {
    const entry = entries[index];
    if (entry) entry.yearMarker = year;
  });
}

function groupByRelease(entries: ChangelogEntry[]): ChangelogEntry[][] {
  const groups: ChangelogEntry[][] = [];
  let current: ChangelogEntry[] = [];

  for (const entry of entries) {
    current.push(entry);
    if (!entry.isPreview) {
      groups.push(current);
      current = [];
    }
  }

  if (current.length) groups.push(current);
  return groups;
}

function main(): void {
  console.log('\x1b[36m[Version Table Generator]\x1b[0m');

  try {
    const files = getChangelogFiles(CONFIG.changelogsDir);

    if (files.length === 0) {
      console.warn('\x1b[1m\x1b[33mWARN\x1b[0m No changelog files found.');
      return;
    }

    const currentHash = getSourceHash(files);

    if (fs.existsSync(CONFIG.outputFile)) {
      try {
        const existingData = JSON.parse(fs.readFileSync(CONFIG.outputFile, 'utf8'));
        if (existingData.hash === currentHash) {
          console.log(`\x1b[1m\x1b[32m  OK\x1b[0m versions.json is up to date`);
          return;
        }
      } catch (err) {
        console.log(`\x1b[1m\x1b[33mWARN\x1b[0m versions.json could not be read, regenerating (${err instanceof Error ? err.message : String(err)})`);
      }
    }

    const entries = readChangelogFiles();

    if (!entries.length) {
      console.warn('\x1b[1m\x1b[33mWARN\x1b[0m No valid entries.');
      return;
    }

    const groups = groupByRelease(entries);
    const previews = entries.filter((e: ChangelogEntry) => e.isPreview).length;

    const output: VersionOutput = {
      hash: currentHash,
      counts: {
        total: entries.length,
        previews,
        releases: entries.length - previews,
      },
      groups: groups.map((g) => g.map(({ _versionIdNumeric, _parsed, ...entry }) => entry)),
    };

    fs.mkdirSync(path.dirname(CONFIG.outputFile), { recursive: true });
    fs.writeFileSync(CONFIG.outputFile, JSON.stringify(output, null, 2));

    console.log(`\x1b[1m\x1b[32m  OK\x1b[0m versions.json → \x1b[1m${entries.length}\x1b[0m versions, \x1b[1m${groups.length}\x1b[0m groups (\x1b[1m${previews}\x1b[0m previews, \x1b[1m${output.counts.releases}\x1b[0m releases)`);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`\x1b[1m\x1b[31m ERR\x1b[0m ${error}`);
    process.exit(1);
  }
}

main();
