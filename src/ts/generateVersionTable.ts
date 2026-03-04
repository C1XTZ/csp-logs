import fs from 'fs';
import path from 'path';
import { REGEX, getChangelogFiles, parseVersion, compareEntries, type ChangelogEntry } from '../ts/changelogUtils.ts';

interface Config {
  changelogsDir: string;
  outputFile: string;
}

interface VersionOutput {
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

function readChangelogFiles(): ChangelogEntry[] {
  const entries: ChangelogEntry[] = getChangelogFiles(CONFIG.changelogsDir)
    .map((filename): ChangelogEntry => {
      const content = fs.readFileSync(path.join(CONFIG.changelogsDir, filename), 'utf8');
      const title = content.match(REGEX.title)?.[1]?.trim();
      const versionIdRaw = content.match(REGEX.versionId)?.[1]?.trim() ?? null;
      const versionIdNumeric = versionIdRaw && /^\d+$/.test(versionIdRaw) ? parseInt(versionIdRaw, 10) : null;
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

  const seenYears = new Set<string>();
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (!entry) continue;
    const year = entry.published?.slice(0, 4);
    if (year && !seenYears.has(year)) {
      seenYears.add(year);
      entry.yearMarker = year;
    }
  }

  return entries;
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

async function main(): Promise<void> {
  console.log('\x1b[36m[Version Table Generator]\x1b[0m');

  try {
    const files = getChangelogFiles(CONFIG.changelogsDir);

    if (files.length === 0) {
      console.warn('\x1b[1m\x1b[33mWARN\x1b[0m No changelog files found.');
      return;
    }

    const newestSrc = Math.max(...files.map((f: string) => fs.statSync(path.join(CONFIG.changelogsDir, f)).mtimeMs));

    const outMtime = fs.existsSync(CONFIG.outputFile) ? fs.statSync(CONFIG.outputFile).mtimeMs : 0;

    if (outMtime >= newestSrc) {
      console.log(`\x1b[1m\x1b[32m  OK\x1b[0m versions.json is up to date`);
      return;
    }

    const entries = readChangelogFiles();

    if (!entries.length) {
      console.warn('\x1b[1m\x1b[33mWARN\x1b[0m No valid entries.');
      return;
    }

    const groups = groupByRelease(entries);
    const previews = entries.filter((e: ChangelogEntry) => e.isPreview).length;

    const output: VersionOutput = {
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
