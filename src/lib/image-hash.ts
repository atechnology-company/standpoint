/**
 * Image hashing utilities for deduplication
 */

/**
 * Calculate SHA-256 hash of a file
 */
export async function hashFile(file: File): Promise<string> {
	const arrayBuffer = await file.arrayBuffer();
	const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
	return hashHex;
}

/**
 * Calculate perceptual hash of an image (simpler version using canvas)
 */
export async function perceptualHash(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		const url = URL.createObjectURL(file);

		img.onload = () => {
			try {
				// Create a small canvas for hash computation
				const canvas = document.createElement('canvas');
				const size = 8; // 8x8 grid for pHash
				canvas.width = size;
				canvas.height = size;
				const ctx = canvas.getContext('2d');

				if (!ctx) {
					reject(new Error('Could not get canvas context'));
					return;
				}

				// Draw image scaled down to 8x8
				ctx.drawImage(img, 0, 0, size, size);

				// Get pixel data
				const imageData = ctx.getImageData(0, 0, size, size);
				const pixels = imageData.data;

				// Convert to grayscale and get average
				let total = 0;
				for (let i = 0; i < pixels.length; i += 4) {
					const gray = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
					total += gray;
				}
				const average = total / (size * size);

				// Create binary hash based on average
				let hash = '';
				for (let i = 0; i < pixels.length; i += 4) {
					const gray = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
					hash += gray > average ? '1' : '0';
				}

				// Convert binary to hex
				const hexHash = parseInt(hash, 2).toString(16).padStart(16, '0');

				URL.revokeObjectURL(url);
				resolve(hexHash);
			} catch (error) {
				URL.revokeObjectURL(url);
				reject(error);
			}
		};

		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('Failed to load image'));
		};

		img.src = url;
	});
}

/**
 * Calculate hamming distance between two hashes
 */
export function hammingDistance(hash1: string, hash2: string): number {
	if (hash1.length !== hash2.length) {
		throw new Error('Hashes must be the same length');
	}

	let distance = 0;
	for (let i = 0; i < hash1.length; i++) {
		if (hash1[i] !== hash2[i]) {
			distance++;
		}
	}
	return distance;
}

/**
 * Check if two images are similar based on perceptual hash
 * @param threshold - Lower is more strict (0-64 for 8x8 hash)
 */
export function areSimilar(hash1: string, hash2: string, threshold: number = 10): boolean {
	try {
		const distance = hammingDistance(hash1, hash2);
		return distance <= threshold;
	} catch {
		return false;
	}
}

/**
 * Store for tracking uploaded image hashes
 */
interface ImageHashEntry {
	hash: string;
	url: string;
	timestamp: number;
}

const IMAGE_HASH_KEY = 'standpoint_image_hashes';

export function saveImageHash(hash: string, url: string): void {
	if (typeof window === 'undefined') return;

	try {
		const stored = localStorage.getItem(IMAGE_HASH_KEY);
		const hashes: ImageHashEntry[] = stored ? JSON.parse(stored) : [];

		hashes.push({
			hash,
			url,
			timestamp: Date.now()
		});

		// Keep only last 500 hashes
		const trimmed = hashes.slice(-500);
		localStorage.setItem(IMAGE_HASH_KEY, JSON.stringify(trimmed));
	} catch (error) {
		console.error('Failed to save image hash:', error);
	}
}

export function findDuplicateImage(hash: string, threshold: number = 10): string | null {
	if (typeof window === 'undefined') return null;

	try {
		const stored = localStorage.getItem(IMAGE_HASH_KEY);
		if (!stored) return null;

		const hashes: ImageHashEntry[] = JSON.parse(stored);

		// Check for exact match first
		const exactMatch = hashes.find((entry) => entry.hash === hash);
		if (exactMatch) {
			return exactMatch.url;
		}

		// Check for similar images
		for (const entry of hashes) {
			if (areSimilar(hash, entry.hash, threshold)) {
				return entry.url;
			}
		}

		return null;
	} catch (error) {
		console.error('Failed to find duplicate image:', error);
		return null;
	}
}

export function clearImageHashes(): void {
	if (typeof window === 'undefined') return;
	localStorage.removeItem(IMAGE_HASH_KEY);
}
