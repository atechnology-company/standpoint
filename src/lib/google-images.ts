import { resultImages, type ImageResult } from './stores';
import { loadResultFromStorage, saveResultToStorage } from './storage';

// API Keys
const GOOGLE_SEARCH_API_KEY = (import.meta as any).env?.VITE_GOOGLE_SEARCH_API_KEY || "YOUR_GOOGLE_SEARCH_API_KEY"; // Replace with your actual API key
const GOOGLE_SEARCH_CX = (import.meta as any).env?.VITE_GOOGLE_SEARCH_CX || "YOUR_GOOGLE_SEARCH_CX"; // Replace with your actual CX

// Search for images related to the query using Google Custom Search API
export async function searchForImages(query: string): Promise<void> {
    try {
        // Check if API keys are configured
        if (GOOGLE_SEARCH_API_KEY === "YOUR_GOOGLE_SEARCH_API_KEY" || GOOGLE_SEARCH_CX === "YOUR_GOOGLE_SEARCH_CX") {
            console.warn("Google Search API keys not configured. Using fallback images.");
            // Generate fallback images related to the query
            const fallbackImages = generateFallbackImages(query);
            resultImages.set(fallbackImages);
            return;
        }

        // Validate API key and CX format
        if (!GOOGLE_SEARCH_API_KEY || GOOGLE_SEARCH_API_KEY.length < 20) {
            console.warn("Invalid Google Search API key format. Using fallback images.");
            const fallbackImages = generateFallbackImages(query);
            resultImages.set(fallbackImages);
            return;
        }

        if (!GOOGLE_SEARCH_CX || GOOGLE_SEARCH_CX.length < 10) {
            console.warn("Invalid Google Search CX format. Using fallback images.");
            const fallbackImages = generateFallbackImages(query);
            resultImages.set(fallbackImages);
            return;
        }

        // Check network status first (only in browser environment)
        if (typeof window !== 'undefined') {
            try {
                // Simple network check without Capacitor dependency
                if (!navigator.onLine) {
                    // Try to load from cache
                    const cachedResult = await loadResultFromStorage(query);
                    if (cachedResult && cachedResult.images) {
                        resultImages.set(cachedResult.images);
                        return;
                    }
                    throw new Error("No internet connection");
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
            num: '6',
            safe: 'active' // Add safe search
        });
        
        const apiUrl = `https://www.googleapis.com/customsearch/v1?${params.toString()}`;
        
        console.log("Making request to Google Custom Search API for query:", query);
        console.log("API URL (key hidden):", apiUrl.replace(GOOGLE_SEARCH_API_KEY, '[API_KEY_HIDDEN]'));
        
        // Use Google Custom Search API to find images
        const response = await fetch(apiUrl);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Google Search API error ${response.status}:`, errorText);
            
            // Try to parse error details
            try {
                const errorJson = JSON.parse(errorText);
                if (errorJson.error) {
                    console.error("API Error details:", errorJson.error);
                }
            } catch (parseError) {
                console.warn("Could not parse error response as JSON");
            }
            
            if (response.status === 403) {
                console.warn("Google Search API quota exceeded or invalid API key - using fallback images");
            } else if (response.status === 400) {
                console.warn("Google Search API bad request (400) - check API key and CX format - using fallback images");
            } else {
                console.warn(`Image search API error: ${response.status} - using fallback images`);
            }
            // Use fallback images when API fails
            const fallbackImages = generateFallbackImages(query);
            resultImages.set(fallbackImages);
            return;
        }

        const data = await response.json();

        if (data.items && data.items.length > 0) {
            const images: ImageResult[] = data.items.map((item: any) => ({
                url: item.link,
                title: item.title,
                thumbnailLink: item.image?.thumbnailLink || item.link, // Use thumbnail if available
            }));

            resultImages.set(images);
            
            // Save to cache for offline access
            await saveResultToStorage(query, images);
        } else {
            resultImages.set([]);
        }
    } catch (error) {
        console.warn("Error searching for images:", error);
        
        // Try to load from cache as fallback
        try {
            const cachedResult = await loadResultFromStorage(query);
            if (cachedResult && cachedResult.images) {
                resultImages.set(cachedResult.images);
            } else {
                // Generate fallback images when nothing else works
                const fallbackImages = generateFallbackImages(query);
                resultImages.set(fallbackImages);
            }
        } catch (cacheError) {
            console.warn("Failed to load images from cache:", cacheError);
            const fallbackImages = generateFallbackImages(query);
            resultImages.set(fallbackImages);
        }
    }
}

// Generate fallback images when Google Search API is not available
function generateFallbackImages(query: string): ImageResult[] {
    // Create meaningful placeholder images based on query keywords
    const fallbackImages: ImageResult[] = [];
    
    // Use different image services for reliability
    const imageServices = [
        {
            name: 'Unsplash',
            getUrl: (q: string, size: string) => `https://source.unsplash.com/${size}/?${encodeURIComponent(q)}&sig=${Math.floor(Math.random() * 1000)}`
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

// Legacy function for backward compatibility
export async function searchGoogleImages(query: string, count: number = 10): Promise<any[]> {
    await searchForImages(query);
    return new Promise((resolve) => {
        let unsubscribe: (() => void) | null = null;
        unsubscribe = resultImages.subscribe((images) => {
            if (unsubscribe) {
                unsubscribe();
            }
            // Convert ImageResult[] to the expected format for backward compatibility
            const compatibleResults = images.slice(0, count).map(image => ({
                title: image.title,
                link: image.url,
                image: {
                    thumbnailLink: image.thumbnailLink
                },
                snippet: `Image result for ${query}`
            }));
            resolve(compatibleResults);
        });
    });
}
