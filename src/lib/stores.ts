import { writable } from 'svelte/store';

export interface ImageResult {
	url: string;
	title: string;
	thumbnailLink: string;
}

// Store for holding image search results
export const resultImages = writable<ImageResult[]>([]);
