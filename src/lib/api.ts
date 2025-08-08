import { firebaseFallbackClient } from './firebase-fallback';

import type {
	PollCreate,
	PollResponse,
	VoteCreate,
	TierListCreate,
	TierListResponse,
	TierListUpdate,
	TierItem,
	TierCreate,
	ItemPlacement
} from './types';

const API_BASE_URL = 'http://localhost:8000';

class ApiClient {
	private baseUrl: string;
	private isBackendAvailable: boolean | null = null;

	constructor(baseUrl: string = API_BASE_URL) {
		this.baseUrl = baseUrl;
	}

	private async checkBackendAvailability(): Promise<boolean> {
		try {
			const response = await fetch(`${this.baseUrl}/health`, {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' },
				signal: AbortSignal.timeout(5000) // 5 second timeout
			});
			return response.ok;
		} catch (error) {
			console.warn('Backend unavailable, using Firebase fallback:', error);
			return false;
		}
	}

	private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
		if (this.isBackendAvailable === null) {
			this.isBackendAvailable = await this.checkBackendAvailability();
		}

		if (!this.isBackendAvailable) {
			throw new Error('Backend unavailable - use Firebase fallback');
		}

		const url = `${this.baseUrl}${endpoint}`;
		const config: RequestInit = {
			headers: {
				'Content-Type': 'application/json',
				...options.headers
			},
			...options
		};

		try {
			const response = await fetch(url, config);

			if (!response.ok) {
				if (response.status >= 500) {
					this.isBackendAvailable = false;
				}
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
			}

			return await response.json();
		} catch (error) {
			this.isBackendAvailable = false;
			console.error('API request failed, marking backend unavailable:', error);
			throw error;
		}
	}

	async healthCheck() {
		try {
			return await this.request('/health');
		} catch (error) {
			return await firebaseFallbackClient.healthCheck();
		}
	}

	async getPolls(): Promise<import('./types').PollResponse[]> {
		try {
			return await this.request('/api/polls');
		} catch (error) {
			console.warn('Using Firebase fallback for getPolls');
			return await firebaseFallbackClient.getPolls();
		}
	}

	async getPoll(id: string): Promise<import('./types').PollResponse> {
		try {
			return await this.request(`/api/polls/${id}`);
		} catch (error) {
			console.warn('Using Firebase fallback for getPoll');
			return await firebaseFallbackClient.getPoll(id);
		}
	}

	async createPoll(poll: import('./types').PollCreate): Promise<import('./types').PollResponse> {
		try {
			return await this.request('/api/polls', {
				method: 'POST',
				body: JSON.stringify(poll)
			});
		} catch (error) {
			console.warn('Using Firebase fallback for createPoll');
			return await firebaseFallbackClient.createPoll(poll);
		}
	}

	async vote(
		pollId: string,
		position: number,
		additionalData?: import('./types').VoteCreate | Record<string, unknown>
	): Promise<import('./types').PollResponse> {
		try {
			const voteData = additionalData || { position };
			return await this.request(`/api/polls/${pollId}/vote`, {
				method: 'POST',
				body: JSON.stringify(voteData)
			});
		} catch (error) {
			console.warn('Using Firebase fallback for vote');
			return await firebaseFallbackClient.vote(pollId, position, additionalData);
		}
	}

	async deletePoll(pollId: string): Promise<void> {
		try {
			return await this.request(`/api/polls/${pollId}`, {
				method: 'DELETE'
			});
		} catch (error) {
			console.warn('Using Firebase fallback for deletePoll');
			return await firebaseFallbackClient.deletePoll(pollId);
		}
	}

	async getTierLists(): Promise<import('./types').TierListResponse[]> {
		try {
			return await this.request('/api/tierlists');
		} catch (error) {
			console.warn('Using Firebase fallback for getTierLists');
			return await firebaseFallbackClient.getTierLists();
		}
	}

	async getTierList(id: string): Promise<import('./types').TierListResponse> {
		try {
			console.log('API getTierList - trying main API first for ID:', id);
			return await this.request(`/api/tierlists/${id}`);
		} catch (error) {
			console.warn('API getTierList - main API failed, using Firebase fallback for ID:', id);
			console.warn('API error was:', error);
			console.log('About to call firebaseFallbackClient.getTierList');
			const result = await firebaseFallbackClient.getTierList(id);
			console.log('API getTierList - Firebase fallback returned:', result);
			return result;
		}
	}

	async createTierList(
		tierList: import('./types').TierListCreate
	): Promise<import('./types').TierListResponse> {
		try {
			return await this.request('/api/tierlists', {
				method: 'POST',
				body: JSON.stringify(tierList)
			});
		} catch (error) {
			console.warn('Using Firebase fallback for createTierList');
			return await firebaseFallbackClient.createTierList(tierList);
		}
	}

	async updateTierListPlacements(
		tierListId: string,
		update: import('./types').TierListUpdate
	): Promise<import('./types').TierListResponse> {
		try {
			return await this.request(`/api/tierlists/${tierListId}/placements`, {
				method: 'PUT',
				body: JSON.stringify(update)
			});
		} catch (error) {
			console.warn('Using Firebase fallback for updateTierListPlacements');
			return await firebaseFallbackClient.updateTierList(tierListId, update);
		}
	}

	async deleteTierList(tierListId: string): Promise<void> {
		try {
			return await this.request(`/api/tierlists/${tierListId}`, {
				method: 'DELETE'
			});
		} catch (error) {
			console.warn('Delete tierlist not supported in Firebase fallback');
			throw new Error('Delete tierlist operation requires backend server');
		}
	}

	async updateTierList(id: string, tierList: any): Promise<TierListResponse> {
		console.log('Updating tier list:', id, tierList);
		try {
			return await this.request(`/api/tierlists/${id}`, {
				method: 'PUT',
				body: JSON.stringify(tierList)
			});
		} catch (error) {
			console.warn('Backend update failed, using Firebase fallback:', error);
			return await firebaseFallbackClient.updateTierList(id, tierList);
		}
	}
}

export const apiClient = new ApiClient();
export { apiClient as default };
