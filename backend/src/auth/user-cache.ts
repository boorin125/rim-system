// Module-level singleton so both AuthService and UsersService share one cache instance
// without creating a circular DI dependency via AuthModule.

const _cache = new Map<number, { data: any; expiresAt: number }>()

export const USER_CACHE_TTL = 30_000 // 30 seconds

export function getUserCache(userId: number): { data: any; expiresAt: number } | undefined {
  return _cache.get(userId)
}

export function setUserCache(userId: number, data: any, expiresAt: number): void {
  _cache.set(userId, { data, expiresAt })
}

export function invalidateUserCache(userId: number): void {
  _cache.delete(userId)
}
