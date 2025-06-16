import type { ImageResult } from './stores';

interface CachedResult {
	images: ImageResult[];
	timestamp: number;
}

const CACHE_KEY_PREFIX = 'image_search_';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export async function loadResultFromStorage(query: string): Promise<CachedResult | null> {
	try {
		const cacheKey = CACHE_KEY_PREFIX + encodeURIComponent(query);
		const cached = localStorage.getItem(cacheKey);
		
		if (!cached) {
			return null;
		}
		
		const result: CachedResult = JSON.parse(cached);
		
		// Check if cache is expired
		if (Date.now() - result.timestamp > CACHE_DURATION) {
			localStorage.removeItem(cacheKey);
			return null;
		}
		
		return result;
	} catch (error) {
		console.warn('Failed to load cached results:', error);
		return null;
	}
}

export async function saveResultToStorage(query: string, images: ImageResult[]): Promise<void> {
	try {
		const cacheKey = CACHE_KEY_PREFIX + encodeURIComponent(query);
		const result: CachedResult = {
			images,
			timestamp: Date.now()
		};
		
		localStorage.setItem(cacheKey, JSON.stringify(result));
	} catch (error) {
		console.warn('Failed to save results to cache:', error);
	}
}
