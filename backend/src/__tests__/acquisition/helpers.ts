/** The paths registered on the admin router, read from its route table. The router applies the admin-only check before any of them. */
export const adminRouterPaths = async (): Promise<string[]> => {
  const { default: router } = await import('../../routes/adminRoutes');
  const stack = (router as unknown as { stack: { route?: { path: string }; name: string }[] }).stack;
  return stack.filter((layer) => layer.route).map((layer) => layer.route!.path);
};
