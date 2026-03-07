// @ts-ignore
import type { SidebarEntry } from '@astrojs/starlight/utils/routing/types';

/**
 * Marks sidebar items as active if they match any of the target slugs.
 * @param entries Sidebar entries to check
 * @param targetSlugs Slugs to match against (without base or leading slash)
 */
export function markSidebarItems(entries: SidebarEntry[], targetSlugs: string[]) {
  for (const entry of entries) {
    if (entry.type === 'link' && entry.href) {
      const normalizedHref = entry.href.replace(/\/$/, '');

      const isMatch = targetSlugs.some((slug) => {
        const normalizedSlug = slug.replace(/^\//, '').replace(/\/$/, '');
        return normalizedHref.endsWith(`/${normalizedSlug}`) || normalizedHref === normalizedSlug;
      });

      if (isMatch) {
        entry.isCurrent = true;
        entry.attrs = {
          ...(entry.attrs ?? {}),
          'aria-current': 'page',
        };
      }
    } else if (entry.type === 'group' && entry.entries) {
      markSidebarItems(entry.entries, targetSlugs);
    }
  }
}
