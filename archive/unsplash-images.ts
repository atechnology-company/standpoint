const UNSPLASH_ACCESS_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;

export async function searchUnsplashImages(query: string, perPage = 10, page = 1) {
	if (!UNSPLASH_ACCESS_KEY) throw new Error('Unsplash access key not set');
	const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}&client_id=${UNSPLASH_ACCESS_KEY}`;
	const res = await fetch(url);
	if (!res.ok) throw new Error('Unsplash API error');
	const data = await res.json();
	return (data.results || []).map((img: any) => ({
		id: img.id,
		thumb: img.urls.thumb,
		full: img.urls.full,
		title: img.alt_description || '',
		description: img.description || ''
	}));
}
