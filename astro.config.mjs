// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightThemeBlack from 'starlight-theme-black';
import fs from 'fs';
import path from 'path';

const changelogsDir = path.join(process.cwd(), 'src', 'content', 'docs', 'changelog');
const changelogFiles = fs
  .readdirSync(changelogsDir)
  .filter((f) => f.endsWith('.md') || f.endsWith('.mdx'))
  .map((f) => {
    const content = fs.readFileSync(path.join(changelogsDir, f), 'utf8');
    let title = content.match(/title:\s*(.+)/)?.[1]?.trim() || f.replace(/\.mdx?$/, '');
    title = title.replace(/^v(?=\d)/, '');
    const slug = f.replace(/\.mdx?$/, '');
    return { slug, title };
  })
  .sort((a, b) => {
    const regex = /(\d+)-(\d+)-(\d+)(p(\d+))?/;
    const matchA = a.slug.match(regex),
      matchB = b.slug.match(regex);
    if (!matchA || !matchB) return 0;
    const [, majA, minA, patA, , preA = '0'] = matchA;
    const [, majB, minB, patB, , preB = '0'] = matchB;
    if (majA !== majB) return +majA - +majB;
    if (minA !== minB) return +minA - +minB;
    if (patA !== patB) return +patA - +patB;
    if (+preA === 0 && +preB > 0) return 1;
    if (+preA > 0 && +preB === 0) return -1;
    return +preA - +preB;
  })
  .reverse()
  .map(({ slug, title }) => ({ label: title, link: `/changelog/${slug}` }));

// https://astro.build/config
export default defineConfig({
  site: 'https://c1xtz.github.io/',
  base: '/csp-logs',
  integrations: [
    starlight({
      defaultLocale: 'en',
      title: 'CSP Version Archive',
      customCss: ['./src/styles/custom.css'],
      tableOfContents: { minHeadingLevel: 1 },
      components: {
        Header: './src/components/Header.astro', //adds Content Manager social icon
      },
      social: [
        { icon: 'discord', label: 'Discord', href: 'https://discord.gg/nM4Xkrt' },
        { icon: 'patreon', label: 'Patreon', href: 'https://www.patreon.com/x4fab' },
        { icon: 'github', label: 'Github', href: 'https://github.com/ac-custom-shaders-patch' },
      ],
      sidebar: [
        { label: 'Version List', link: 'versions' },
        { label: 'Changelogs', items: changelogFiles },
      ],
      plugins: [
        starlightThemeBlack({
          footerText: 'This site is maintained by [C1XTZ](https://github.com/C1XTZ), a 3rd party unaffiated with Custom Shaders Patch. You can contriube [here.](https://github.com/C1XTZ/csp-logs)',
        }),
      ],
    }),
  ],
});
