// Fails closed: without a configured list, nobody is an admin.
export function isAdmin(
  platform: string,
  userId: string,
  adminUserIds: string | undefined,
): boolean {
  if (!adminUserIds) return false;
  const expected = `${platform}:${userId}`;
  return adminUserIds.split(",").some((entry) => entry.trim() === expected);
}
