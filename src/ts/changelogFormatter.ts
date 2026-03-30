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

    const originalText = fs.readFileSync(path.join(dir, file), 'utf8');
    let content = originalText.replace(/\r\n/g, '\n');

    content = content
      .replace(/\u201c/g, '`')
      .replace(/\u201d/g, '`')
      .replace(/\u2019/g, "'");

    if (content.match(/#\s*Changelog\s*\n\s*(?:-|\*)/)) {
      content = content.replace(/(#\s*Changelog\s*\n)(\s*)(?:-|\*)/, '$1$2## New features, options and improvements\n\n$2*');
    }

    content = content.replace(/(?:[-*+])\s+Published:\s*(\d{4})-(\d{1,2})-(\d{1,2})/gi, (_, y, m, d) => {
      return `* Published: ${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    });

    const lines = content.split('\n');
    const newLines = [];
    let listIndentLevels: number[] = [0];
    let inChangelog = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line?.match(/^#\s*Changelog/i)) {
        inChangelog = true;
      }

      const match = line?.match(/^(\s*)([-*+])\s+(.*)$/);

      if (match) {
        const spaces = match[1]?.length ?? 0;
        let text = match[3] ?? '';

        text = text.trimEnd();
        if (inChangelog) {
          text = text.replace(/([;.,]+)$/, '');
          if (!text.match(/[:!?]$/)) {
            text += ';';
          }
        } else {
          text = text.replace(/ ([;.,:])$/, '$1');
        }
        text = text.replace(/\s+/g, ' ');

        let parts = text.split('`');
        if (parts.length > 2) {
          for (let j = 2; j < parts.length; j += 2) {
            if (parts[j] === '/') {
              parts[j] = ' / ';
            }
          }
          text = parts.join('`');
        }

        let level = 0;
        const lastIndent = listIndentLevels[listIndentLevels.length - 1] ?? 0;

        if (spaces > lastIndent) {
          listIndentLevels.push(spaces);
          level = listIndentLevels.length - 1;
        } else if (spaces < lastIndent) {
          while (listIndentLevels.length > 1 && spaces < (listIndentLevels[listIndentLevels.length - 1] ?? 0)) {
            listIndentLevels.pop();
          }
          if (spaces > (listIndentLevels[listIndentLevels.length - 1] ?? 0)) {
            listIndentLevels.push(spaces);
            level = listIndentLevels.length - 1;
          } else {
            level = listIndentLevels.length - 1;
          }
        } else {
          level = listIndentLevels.length - 1;
        }

        newLines.push(' '.repeat(level * 4) + '*   ' + text);
      } else {
        if (line && line.trim() !== '') {
          listIndentLevels = [0];
        }
        newLines.push(line ?? '');
      }
    }

    content = newLines.join('\n');

    const fm = content.match(/^---\n([\s\S]*?)\n---\n/);
    let isAdd = false;

    if (fm) {
      const fmFull = fm[0] ?? '';
      const fmBody = fm[1] ?? '';
      const titleMatch = fmBody.match(/^title:\s*(.+)$/m);
      if (titleMatch?.[1]?.trim() !== title) {
        let newFm = fmBody.replace(/^title:.*$/m, `title: ${title}`);
        if (!newFm.includes('title:')) newFm = `title: ${title}\n${newFm}`;
        content = `---\n${newFm}\n---\n` + content.slice(fmFull.length);
      }
    } else {
      content = `---\ntitle: ${title}\n---\n${content}`;
      isAdd = true;
    }

    const finalContent = content.replace(/\n/g, '\r\n');
    if (finalContent === originalText) {
      unchanged++;
    } else {
      if (isAdd) {
        console.log(`\x1b[1m\x1b[34m ADD\x1b[0m ${file} → ${title}`);
      } else {
        console.log(`\x1b[1m\x1b[33m FIX\x1b[0m ${file} → Formatted & Updated`);
      }
      fs.writeFileSync(path.join(dir, file), finalContent);
    }
  }
  console.log(`\x1b[1m\x1b[32m  OK\x1b[0m \x1b[1m${unchanged}\x1b[0m files unchanged`);
} catch (err) {
  const error = err instanceof Error ? err.message : String(err);
  console.error(`\x1b[1m\x1b[31m ERR\x1b[0m ${error}`);
  process.exit(1);
}
