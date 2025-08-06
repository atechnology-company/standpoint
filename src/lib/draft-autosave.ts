import type { TierItem } from './api';

export interface TierListDraft {
	id: string;
	title: string;
	type: 'classic' | 'dynamic';
	bannerImage?: string;
	tiers: Array<{
		id: string;
		name: string;
		color: string;
		items: TierItem[];
	}>;
	unassignedItems: TierItem[];
	lastSaved: number;
}

const DRAFT_STORAGE_KEY = 'standpoint_tierlist_drafts';
const AUTOSAVE_INTERVAL = 10000;
const MAX_DRAFTS = 5;

export function saveDraft(draft: TierListDraft): void {
	try {
		const existingDrafts = getDrafts();
		const updatedDraft = { ...draft, lastSaved: Date.now() };

		const filteredDrafts = existingDrafts.filter((d) => d.id !== draft.id);

		const newDrafts = [updatedDraft, ...filteredDrafts].slice(0, MAX_DRAFTS);

		localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(newDrafts));
	} catch (error) {
		console.warn('Failed to save draft:', error);
	}
}

export function getDrafts(): TierListDraft[] {
	try {
		const stored = localStorage.getItem(DRAFT_STORAGE_KEY);
		if (!stored) return [];

		const drafts = JSON.parse(stored) as TierListDraft[];
		// Sort by lastSaved descending
		return drafts.sort((a, b) => b.lastSaved - a.lastSaved);
	} catch (error) {
		console.warn('Failed to load drafts:', error);
		return [];
	}
}

export function getDraft(id: string): TierListDraft | null {
	const drafts = getDrafts();
	return drafts.find((d) => d.id === id) || null;
}

export function deleteDraft(id: string): void {
	try {
		const drafts = getDrafts();
		const filteredDrafts = drafts.filter((d) => d.id !== id);
		localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(filteredDrafts));
	} catch (error) {
		console.warn('Failed to delete draft:', error);
	}
}

export function createAutosaver(
	getCurrentData: () => TierListDraft,
	isDataValid: () => boolean
): () => void {
	let intervalId: number;

	const save = () => {
		if (isDataValid()) {
			const data = getCurrentData();
			saveDraft(data);
		}
	};

	save();

	intervalId = window.setInterval(save, AUTOSAVE_INTERVAL);

	return () => {
		if (intervalId) {
			clearInterval(intervalId);
		}
	};
}
