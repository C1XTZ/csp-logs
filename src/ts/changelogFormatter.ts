import fs from 'fs';
import path from 'path';
import { filenameToTitle, getChangelogFiles } from '../ts/changelogUtils.ts';

const dir = path.join(process.cwd(), 'src', 'content', 'docs');

console.log('\x1b[36m[Changelog Formatter]\x1b[0m');

let unchanged = 0;

try {
  const files = getChangelogFiles(dir);

  for (const file of files) {
    const title = filenameToTitle(path.basename(file, '.md'));
    if (!title) continue;

    let content = fs.readFileSync(path.join(dir, file), 'utf8').replace(/\r\n/g, '\n');

    content = content
      .replace(/\u201c/g, '`')
      .replace(/\u201d/g, '`')
      .replace(/\u2019/g, "'");

    const fm = content.match(/^---\n([\s\S]*?)\n---\n/);

    if (fm) {
      const fmFull = fm[0] ?? '';
      const fmBody = fm[1] ?? '';
      const titleMatch = fmBody.match(/^title:\s*(.+)$/m);
      if (titleMatch?.[1]?.trim() === title) {
        unchanged++;
        continue;
      } else {
        let newFm = fmBody.replace(/^title:.*$/m, `title: ${title}`);
        if (!newFm.includes('title:')) newFm = `title: ${title}\n${newFm}`;
        content = `---\n${newFm}\n---\n` + content.slice(fmFull.length);
        console.log(`\x1b[1m\x1b[33m FIX\x1b[0m ${file} → ${title}`);
      }
    } else {
      content = `---\ntitle: ${title}\n---\n${content}`;
      console.log(`\x1b[1m\x1b[34m ADD\x1b[0m ${file} → ${title}`);
    }

    fs.writeFileSync(path.join(dir, file), content.replace(/\n/g, '\r\n'));
  }
  console.log(`\x1b[1m\x1b[32m  OK\x1b[0m \x1b[1m${unchanged}\x1b[0m files unchanged`);
} catch (err) {
  const error = err instanceof Error ? err.message : String(err);
  console.error(`\x1b[1m\x1b[31m ERR\x1b[0m ${error}`);
  process.exit(1);
}
