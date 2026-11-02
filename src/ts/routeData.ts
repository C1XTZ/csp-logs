import { defineRouteMiddleware } from '@astrojs/starlight/route-data';

const isChangelog = (path: string) => /^\d+-\d+-\d+(?:p\d+)?$/.test(path.split('/').filter(Boolean).pop() ?? '');

export const onRequest = defineRouteMiddleware((context) => {
  const { pagination } = context.locals.starlightRoute;

  // Overview pages (home, latest/*, versions): no pagination at all.
  if (!isChangelog(context.url.pathname)) {
    pagination.prev = undefined;
    pagination.next = undefined;
    return;
  }

  // Changelog pages: only link to other changelogs.
  if (pagination.prev && !isChangelog(pagination.prev.href)) pagination.prev = undefined;
  if (pagination.next && !isChangelog(pagination.next.href)) pagination.next = undefined;
});
