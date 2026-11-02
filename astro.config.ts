import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightThemeBlack from 'starlight-theme-black';
import fs from 'fs';
import path from 'path';
import { getChangelogFiles } from './src/ts/changelogUtils.ts';
import versions from './src/data/versions.json' assert { type: 'json' };

const flat = versions.groups.flat();
const latestPreviewVersion = flat.find((v) => v.isPreview);
const latestPublicVersion = flat.find((v) => !v.isPreview);

const changelogsDir = path.join(process.cwd(), 'src', 'content', 'docs');

const changelogFiles = getChangelogFiles(changelogsDir)
  .map((f: string) => {
    const content = fs.readFileSync(path.join(changelogsDir, f), 'utf8');
    const title = content.match(/title:\s*(.+)/)?.[1]?.trim() || f.replace(/\.mdx?$/, '');
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
  .map(({ slug, title }) => {
    const version = flat.find((v) => v.link === `/csp-logs/${slug}` || v.link === `/${slug}`);
    if (version && version.published) {
      return { label: title, link: `/${slug}`, attrs: { 'data-timeago': version.published } };
    }
    return { label: title, link: `/${slug}` };
  });

// https://astro.build/config
export default defineConfig({
  site: 'https://c1xtz.github.io/',
  base: '/csp-logs',
  integrations: [
    starlight({
      defaultLocale: 'en',
      title: 'Custom Shaders Patch Changelog Archive',
      customCss: ['./src/styles/custom.css'],
      routeMiddleware: './src/ts/routeData.ts',
      tableOfContents: { minHeadingLevel: 1 },
      components: {
        Sidebar: './src/components/Sidebar.astro', //adds Bidirectional activation of sidebar items (going to /latest/public will also highlight the version its mirroring in the sidebar and vice versa)
        Footer: './src/components/Footer.astro', //adds footer text
        SocialIcons: './src/components/SocialIcons.astro', //adds Content Manager icon to header
      },
      social: [
        { icon: 'discord', label: 'Discord', href: 'https://discord.gg/nM4Xkrt' },
        { icon: 'patreon', label: 'Patreon', href: 'https://www.patreon.com/x4fab' },
        { icon: 'github', label: 'Github', href: 'https://github.com/ac-custom-shaders-patch' },
      ],
      sidebar: [
        {
          label: 'Overview',
          items: [
            { slug: '/' },
            { label: 'Latest Preview', link: '/latest/preview', attrs: { 'data-timeago': latestPreviewVersion?.published } },
            { label: 'Latest Public', link: '/latest/public', attrs: { 'data-timeago': latestPublicVersion?.published } },
            { slug: 'versions' },
          ],
        },
        { label: 'Changelogs', items: changelogFiles },
      ],
      plugins: [
        starlightThemeBlack({
          docs: {
            showMarkdownActions: {
              prompt: '',
              agents: {
                chatgpt: false,
                claude: false,
                v0: false,
                scira: false,
              },
            },
          },
        }),
      ],
    }),
  ],
});
