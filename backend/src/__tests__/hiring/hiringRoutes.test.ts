import { describe, expect, it } from 'vitest';
import { adminRouterPaths } from '../acquisition/helpers';

type Layer = { route?: { path: string; methods: Record<string, boolean> }; name: string };
const routesOf = (router: unknown) => (router as { stack: Layer[] }).stack.filter((layer) => layer.route).map((layer) => `${Object.keys(layer.route!.methods)[0].toUpperCase()} ${layer.route!.path}`);

describe('who can reach the Hiring Service routes', () => {
  it('puts the money, the terms, the settings and the recruiter accounts behind the admin-only router', async () => {
    const paths = await adminRouterPaths();
    for (const path of ['/hiring/requests', '/hiring/requests/:id/assign', '/hiring/requests/:id/terms', '/hiring/requests/:id/payments', '/hiring/requests/:id/payments/:paymentId/remove', '/hiring/settings', '/hiring/staff', '/hiring/staff/:userId']) {
      expect(paths).toContain(path);
    }
  });

  it('gives recruiters the working routes (their own requests) and no money or settings routes', async () => {
    const { recruiterRouter } = await import('../../routes/hiringRoutes');
    const routes = routesOf(recruiterRouter);
    for (const route of ['GET /requests', 'GET /requests/:id', 'POST /requests/:id/job', 'POST /requests/:id/import-applicants', 'POST /requests/:id/send', 'POST /requests/:id/status', 'POST /requests/:id/candidates/:candidateId/shortlist']) {
      expect(routes).toContain(route);
    }
    expect(routes.some((route) => /payment|terms|settings|staff/.test(route))).toBe(false);
  });

  it('keeps the public price page open to everyone, and the rest behind a sign-in', async () => {
    const { hiringRouter } = await import('../../routes/hiringRoutes');
    const layers = (hiringRouter as unknown as { stack: { route?: { path: string; stack: { name: string }[] } }[] }).stack.filter((layer) => layer.route);
    const info = layers.find((layer) => layer.route!.path === '/info')!;
    expect(info.route!.stack).toHaveLength(1); // no auth middleware in front of it
    const requests = layers.find((layer) => layer.route!.path === '/requests')!;
    expect(requests.route!.stack.length).toBeGreaterThan(1);
  });
});
