const fs = require('fs');
const path = require('path');

const changelogsDir = path.join(__dirname, 'docs', 'changelogs');
const changelogFiles = fs
  .readdirSync(changelogsDir)
  .filter((file) => file.endsWith('.md'))
  .map((file) => `changelogs/${file.replace('.md', '')}`)
  .sort((a, b) => {
    const regex = /(\d+)-(\d+)-(\d+)(p(\d+))?/;
    const matchA = a.match(regex);
    const matchB = b.match(regex);

    if (!matchA || !matchB) return 0;

    const majorA = parseInt(matchA[1]);
    const minorA = parseInt(matchA[2]);
    const patchA = parseInt(matchA[3]);
    const previewA = matchA[4] ? parseInt(matchA[5]) : 0;

    const majorB = parseInt(matchB[1]);
    const minorB = parseInt(matchB[2]);
    const patchB = parseInt(matchB[3]);
    const previewB = matchB[4] ? parseInt(matchB[5]) : 0;

    if (majorA !== majorB) return majorA - majorB;
    if (minorA !== minorB) return minorA - minorB;
    if (patchA !== patchB) return patchA - patchB;

    if (previewA === 0 && previewB > 0) return 1;
    if (previewA > 0 && previewB === 0) return -1;

    return previewA - previewB;
  })
  .reverse();

const sidebars = {
  versionSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Changelogs',
      items: changelogFiles,
    },
  ],
};

export default sidebars;
