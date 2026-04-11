type CacheItem<T> = {
  data: T;
  expiry: number;
};

class CacheManager {
  private cache = new Map<string, CacheItem<any>>();

  // Set item in cache with Time-To-Live in milliseconds
  set<T>(key: string, data: T, ttlMs: number) {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttlMs,
    });
  }

  // Get item from cache if it exists and hasn't expired
  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    // Check expiration
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data as T;
  }

  // Exact key invalidation
  invalidate(key: string) {
    this.cache.delete(key);
  }

  // Pattern-based invalidation (e.g., invalidate all "ProjectSummary_")
  invalidatePattern(pattern: string) {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  // Clear entire cache
  clear() {
    this.cache.clear();
  }
}

// Global singleton instance
export const cacheManager = new CacheManager();

// Standard TTLs configured exactly to specifications
export const CACHE_TTL = {
  DASHBOARD: 60 * 1000,       // 30-60 seconds for dashboards
  REPORT: 15 * 60 * 1000,     // 5-15 minutes for financial reports
  STATIC: 60 * 60 * 1000,     // 1 hour for static reference data
};

// Structured Cache Keys supporting Multi-Tenant Architecture
export const CACHE_KEYS = {
  projectSummary: (projectId: string) => `ProjectSummary_${projectId}`,
  companyDashboard: (companyId: string = 'default') => `CompanyDashboard_${companyId}`,
  report: (companyId: string, dateRange: string) => `Report_${companyId}_${dateRange}`,
  bomSummary: (projectId: string) => `BOMSummary_${projectId}`,
  staticMaterials: () => `Static_Materials`,
};