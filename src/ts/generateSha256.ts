import fs from 'fs';
import path from 'path';
import { REGEX, getChangelogFiles } from './changelogUtils.ts';

// sha256.json started as a list x4fab sent me on 2026-10-26 with the hashes of
// everything he still had, which is why it includes versions that were never
// publicly released. Changelogs older than 0.1.79 stay without a hash, since I'd
// have to get those from sources I can't verify instead of from x4fab himself.
// Anything after 0.3.0-preview736 was added manually by C1XTZ.

const CONFIG = {
  changelogsDir: path.resolve(process.cwd(), 'src', 'content', 'docs'),
  outputFile: path.resolve(process.cwd(), 'src', 'data', 'sha256.json'),
};

function readExisting(): Record<string, string> {
  if (!fs.existsSync(CONFIG.outputFile)) return {};
  return JSON.parse(fs.readFileSync(CONFIG.outputFile, 'utf8'));
}

function readChangelogShas(): Record<string, string> {
  const shas: Record<string, string> = {};

  for (const filename of getChangelogFiles(CONFIG.changelogsDir)) {
    const content = fs.readFileSync(path.join(CONFIG.changelogsDir, filename), 'utf8');
    const versionName = content.match(REGEX.title)?.[1]?.trim() || filename.replace(/\.mdx?$/, '');
    const sha = content.match(REGEX.sha256)?.[1];
    if (sha) shas[versionName] = sha.toLowerCase();
  }

  return shas;
}

function main(): void {
  console.log('\x1b[36m[SHA-256 Generator]\x1b[0m');

  try {
    const shas = readExisting();
    let added = 0;
    let changed = 0;

    for (const [versionName, sha] of Object.entries(readChangelogShas())) {
      if (!(versionName in shas)) added++;
      else if (shas[versionName] !== sha) {
        changed++;
        console.warn(`\x1b[1m\x1b[33mWARN\x1b[0m ${versionName}: sha differs from sha256.json, using the changelog's`);
      }
      shas[versionName] = sha;
    }

    const output = JSON.stringify(shas, null, 2);
    const total = Object.keys(shas).length;

    if (fs.existsSync(CONFIG.outputFile) && fs.readFileSync(CONFIG.outputFile, 'utf8') === output) {
      console.log(`\x1b[1m\x1b[32m  OK\x1b[0m sha256.json is up to date (\x1b[1m${total}\x1b[0m shas)`);
      return;
    }

    fs.mkdirSync(path.dirname(CONFIG.outputFile), { recursive: true });
    fs.writeFileSync(CONFIG.outputFile, output);

    console.log(`\x1b[1m\x1b[32m  OK\x1b[0m sha256.json → \x1b[1m${total}\x1b[0m shas (\x1b[1m${added}\x1b[0m added, \x1b[1m${changed}\x1b[0m changed)`);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`\x1b[1m\x1b[31m ERR\x1b[0m ${error}`);
    process.exit(1);
  }
}

main();
