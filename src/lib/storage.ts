import type { ImageResult } from './stores';
import { storage } from './firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

interface CachedResult {
	images: ImageResult[];
	timestamp: number;
}

const CACHE_KEY_PREFIX = 'image_search_';
const CACHE_DURATION = 24 * 60 * 60 * 1000;

/**
 * Loads a cached result from localStorage for the given query.
 * @param query
 * @returns
 */
export async function loadResultFromStorage(query: string): Promise<CachedResult | null> {
	try {
		const cacheKey = CACHE_KEY_PREFIX + encodeURIComponent(query);
		const cached = localStorage.getItem(cacheKey);

		if (!cached) {
			return null;
		}

		const result: CachedResult = JSON.parse(cached);

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

// Firebase Storage functions for file uploads
export async function uploadProfileImage(
	file: File,
	userId: string,
	type: 'avatar' | 'banner' = 'avatar'
): Promise<string> {
	try {
		const fileExtension = file.name.split('.').pop();
		const fileName = `${type}_${userId}_${Date.now()}.${fileExtension}`;
		const storageRef = ref(storage, `profile-images/${fileName}`);
		const snapshot = await uploadBytes(storageRef, file);
		const downloadURL = await getDownloadURL(snapshot.ref);
		return downloadURL;
	} catch (error) {
		console.error(`Error uploading ${type} image:`, error);
		throw new Error('Failed to upload image');
	}
}

export async function deleteProfileImage(imageUrl: string): Promise<void> {
	try {
		const urlParts = imageUrl.split('/');
		const fileName = urlParts[urlParts.length - 1].split('?')[0];
		const storageRef = ref(storage, `profile-images/${fileName}`);

		await deleteObject(storageRef);
	} catch (error) {
		console.error('Error deleting profile image:', error);
	}
}
