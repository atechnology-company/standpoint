// please change your provider already ts pmo
import { resultImages, imageSearchLoading, currentUser, type ImageResult } from './stores';
import { get } from 'svelte/store';
import { loadResultFromStorage, saveResultToStorage } from './storage';

// API Keys
const GOOGLE_SEARCH_API_KEY = import.meta.env?.VITE_GOOGLE_SEARCH_API_KEY;
const GOOGLE_SEARCH_CX = import.meta.env?.VITE_GOOGLE_SEARCH_CX;

// Search for images related to the query using Google Custom Search API
export async function searchForImages(query: string): Promise<ImageResult[]> {
	try {
		// Require authenticated user
		const user = get(currentUser);
		if (!user) {
			console.warn('Image search blocked: user not signed in');
			resultImages.set([]);
			return [];
		}
		imageSearchLoading.set(true);
		// Check if API keys are configured
		if (
			GOOGLE_SEARCH_API_KEY === 'YOUR_GOOGLE_SEARCH_API_KEY' ||
			GOOGLE_SEARCH_CX === 'YOUR_GOOGLE_SEARCH_CX'
		) {
			console.warn('Google Search API keys not configured. Using fallback images.');
			const fallbackImages = generateFallbackImages(query);
			resultImages.set(fallbackImages);
			return fallbackImages;
		}

		// Validate API key and CX format
		if (!GOOGLE_SEARCH_API_KEY || GOOGLE_SEARCH_API_KEY.length < 20) {
			console.warn('Invalid Google Search API key format. Using fallback images.');
			const fallbackImages = generateFallbackImages(query);
			resultImages.set(fallbackImages);
			return fallbackImages;
		}

		if (!GOOGLE_SEARCH_CX || GOOGLE_SEARCH_CX.length < 10) {
			console.warn('Invalid Google Search CX format. Using fallback images.');
			const fallbackImages = generateFallbackImages(query);
			resultImages.set(fallbackImages);
			return fallbackImages;
		}

		// Check network status first (only in browser environment)
		if (typeof window !== 'undefined') {
			try {
				if (!navigator.onLine) {
					const cachedResult = await loadResultFromStorage(query);
					if (cachedResult && cachedResult.images) {
						resultImages.set(cachedResult.images);
						imageSearchLoading.set(false);
						return cachedResult.images;
					}
					throw new Error('No internet connection');
				}
			} catch (error) {
				console.warn('Network status check failed, proceeding with search:', error);
				// Continue with search even if network check fails
			}
		}

		// Construct the Google Custom Search API URL with proper parameters
		const params = new URLSearchParams({
			key: GOOGLE_SEARCH_API_KEY,
			cx: GOOGLE_SEARCH_CX,
			q: query,
			searchType: 'image',
			num: '6'
		});

		const apiUrl = `https://www.googleapis.com/customsearch/v1?${params.toString()}`;

		const response = await fetch(apiUrl, { headers: { Accept: 'application/json' } });

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`Google Search API error ${response.status}:`, errorText);

			// Try to parse error details
			try {
				const errorJson = JSON.parse(errorText);
				if (errorJson.error) {
					console.error('API Error details:', errorJson.error);
				}
			} catch {
				console.warn('Could not parse error response as JSON');
			}

			if (response.status === 403) {
				console.warn('Google Search API quota exceeded or invalid API key - using fallback images');
			} else if (response.status === 400) {
				console.warn(
					'Google Search API bad request (400) - check API key and CX format - using fallback images'
				);
			} else {
				console.warn(`Image search API error: ${response.status} - using fallback images`);
			}
			// Use fallback images when API fails
			const fallbackImages = generateFallbackImages(query);
			resultImages.set(fallbackImages);
			imageSearchLoading.set(false);
			return fallbackImages;
		}

		const data = await response.json();

		let images: ImageResult[] = [];
		if (data.items && data.items.length > 0) {
			images = data.items.map((item: Record<string, unknown>) => ({
				url: item.link,
				title: item.title,
				thumbnailLink:
					(item.image && (item.image as { thumbnailLink?: string }).thumbnailLink) || item.link
			}));
			resultImages.set(images);
			await saveResultToStorage(query, images);
		} else {
			resultImages.set([]);
		}
		imageSearchLoading.set(false);
		return images;
	} catch (error) {
		console.warn('Error searching for images:', error);

		// Try to load from cache as fallback
		try {
			const cachedResult = await loadResultFromStorage(query);
			if (cachedResult && cachedResult.images) {
				resultImages.set(cachedResult.images);
				imageSearchLoading.set(false);
				return cachedResult.images;
			} else {
				console.warn('No cached images found, generating fallback images.');
				const fallbackImages = generateFallbackImages(query);
				resultImages.set(fallbackImages);
				imageSearchLoading.set(false);
				return fallbackImages;
			}
		} catch (cacheError) {
			console.warn('Failed to load images from cache:', cacheError);
			const fallbackImages = generateFallbackImages(query);
			resultImages.set(fallbackImages);
			imageSearchLoading.set(false);
			return fallbackImages;
		}
	} finally {
		imageSearchLoading.set(false);
	}
}

// Generate fallback images when Google Search API is not available
function generateFallbackImages(query: string): ImageResult[] {
	const fallbackImages: ImageResult[] = [];

	const imageServices = [
		{
			name: 'Unsplash',
			getUrl: (q: string, size: string) =>
				`https://source.unsplash.com/${size}/?${encodeURIComponent(q)}&sig=${Math.floor(Math.random() * 1000)}`
		},
		{
			name: 'Picsum',
			getUrl: (_q: string, size: string) => {
				const [width, height] = size.split('x');
				const id = Math.floor(Math.random() * 1000) + 1;
				return `https://picsum.photos/id/${id}/${width}/${height}`;
			}
		},
		{
			name: 'Lorem Picsum',
			getUrl: (q: string, size: string) => {
				const [width, height] = size.split('x');
				const seed = encodeURIComponent(q) + Math.floor(Math.random() * 100);
				return `https://picsum.photos/seed/${seed}/${width}/${height}`;
			}
		}
	];

	// Create diverse queries for better image variety
	const imageQueries = [query, `${query} concept`, `${query} abstract`];

	imageQueries.forEach((searchQuery, index) => {
		const service = imageServices[index % imageServices.length];
		const imageUrl = service.getUrl(searchQuery, '800x600');
		const thumbnailUrl = service.getUrl(searchQuery, '400x300');

		fallbackImages.push({
			url: imageUrl,
			title: `${query} - ${service.name} Image ${index + 1}`,
			thumbnailLink: thumbnailUrl
		});
	});

	return fallbackImages;
}
