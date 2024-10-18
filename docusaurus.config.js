// @ts-check
// `@type` JSDoc annotations allow editor autocompletion and type checking
// (when paired with `@ts-check`).
// There are various equivalent ways to declare your Docusaurus config.
// See: https://docusaurus.io/docs/api/docusaurus-config

import { themes as prismThemes } from 'prism-react-renderer';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Custom Shaders Patch Changelog Archive',
  favicon: 'img/favicon.ico',
  url: 'https://github.com',
  baseUrl: '/ac-csp-changelog-archive/',
  projectName: 'ac-csp-changelog-archive',
  organizationName: 'C1XTZ',
  deploymentBranch: 'gh-pages',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          routeBasePath: '/',
          sidebarPath: './sidebars.js',
          sidebarCollapsible: false,
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      colorMode: {
        defaultMode: 'dark',
        disableSwitch: true,
      },
      navbar: {
        title: 'CSP Version Archive',
        logo: {
          alt: 'Content Manager Icon',
          src: 'img/favicon.ico',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'versionSidebar',
            position: 'left',
            label: 'Changelogs',
          },
          {
            to: 'https://github.com/C1XTZ/ac-csp-changelog-archive',
            "aria-label": 'GitHub',
            className: 'navbar-github',
            position: 'right',
          },
        ],
      },
      prism: {
        darkTheme: prismThemes.dracula,
      },
    }),
};

export default config;
