const BING_IMAGE_SEARCH_KEY = import.meta.env.VITE_BING_IMAGE_SEARCH_KEY;

export async function searchBingImages(query: string, count = 10, offset = 0) {
	if (!BING_IMAGE_SEARCH_KEY) throw new Error('Bing Image Search key not set');
	const url = `https://api.bing.microsoft.com/v7.0/images/search?q=${encodeURIComponent(query)}&count=${count}&offset=${offset}`;
	const res = await fetch(url, {
		headers: {
			'Ocp-Apim-Subscription-Key': BING_IMAGE_SEARCH_KEY
		}
	});
	if (!res.ok) throw new Error('Bing Image Search API error');
	const data = await res.json();
	return (data.value || []).map((img: any) => ({
		id: img.imageId || img.contentUrl,
		thumb: img.thumbnailUrl,
		full: img.contentUrl,
		title: img.name || '',
		description: img.hostPageDisplayUrl || ''
	}));
}
