export function canDeleteManagedAccount(actorId: string, targetId: string, targetIsAdmin: boolean) {
  return Boolean(actorId && targetId && actorId !== targetId && !targetIsAdmin);
}
