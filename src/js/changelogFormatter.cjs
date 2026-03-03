const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../content/docs');

function filenameToTitle(name) {
  const m = name.match(/^(\d+)-(\d+)-(\d+)(?:p(\d+))?$/);
  if (!m) return null;
  return `${m[1]}.${m[2]}.${m[3]}${m[4] ? `-preview${m[4]}` : ''}`;
}

console.log('\x1b[36m[Changelog Formatter]\x1b[0m');

let unchanged = 0;
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.md'))) {
  const title = filenameToTitle(path.basename(file, '.md'));
  if (!title) continue;

  let content = fs.readFileSync(path.join(dir, file), 'utf8').replace(/\r\n/g, '\n');
  content = content
    .replace(/\u201c/g, '`')
    .replace(/\u201d/g, '`')
    .replace(/\u2019/g, "'");

  const fm = content.match(/^---\n([\s\S]*?)\n---\n/);

  if (fm) {
    const titleMatch = fm[1].match(/^title:\s*(.+)$/m);
    if (titleMatch && titleMatch[1].trim() === title) {
      unchanged++;
      continue;
    } else {
      let newFm = fm[1].replace(/^title:.*$/m, `title: ${title}`);
      if (!newFm.includes('title:')) newFm = `title: ${title}\n${newFm}`;
      content = `---\n${newFm}\n---\n` + content.slice(fm[0].length);
      console.log(`\x1b[1m\x1b[33m FIX\x1b[0m ${file} → ${title}`);
    }
  } else {
    content = `---\ntitle: ${title}\n---\n${content}`;
    console.log(`\x1b[1m\x1b[34m ADD\x1b[0m ${file} → ${title}`);
  }

  fs.writeFileSync(path.join(dir, file), content.replace(/\n/g, '\r\n'));
}
console.log(`\x1b[1m\x1b[32m  OK\x1b[0m \x1b[1m${unchanged}\x1b[0m files unchanged`);
