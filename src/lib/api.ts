// api client for backend, will be replaced later with a proper url once hosted
const API_BASE_URL = 'http://localhost:8000';

// Type definitions matching backend models
export interface PollCreate {
	title: string;
	description?: string;
	response_type: number | string;
	options?: string[];
}

export interface VoteCreate {
	poll_id: number;
	position: number; 
}

export interface PollStats {
	average: number;
	std_dev: number;
	total_votes: number;
	vote_positions: number[];
}

export interface PollResponse {
	id: number;
	title: string;
	description?: string;
	response_type: number;
	options: string[];
	stats: PollStats;
	user_vote?: number;
	created_at: string;
}

export interface TierCreate {
	name: string;
	position: number;
}

export interface TierItem {
	id: string;
	text: string;
	image?: string;
	type: 'text' | 'image' | 'search';
	position?: { x: number; y: number };
	size?: { width: number; height: number };
	naturalSize?: { width: number; height: number };
}

export interface ItemPlacement {
	item_id: string;
	tier_position: number;
	position?: { x: number; y: number };
	size?: { width: number; height: number };
}

export interface TierListCreate {
	title: string;
	description?: string;
	list_type?: 'classic' | 'dynamic';
	tiers: TierCreate[];
	items: TierItem[];
}

export interface TierListUpdate {
	item_placements: ItemPlacement[];
}

export interface TierListResponse {
	id: number;
	title: string;
	description?: string;
	list_type: string;
	tiers: TierCreate[];
	items: TierItem[];
	item_placements: ItemPlacement[];
	created_at: string;
}

class ApiClient {
	private baseUrl: string;

	constructor(baseUrl: string = API_BASE_URL) {
		this.baseUrl = baseUrl;
	}

	private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
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
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
			}

			return await response.json();
		} catch (error) {
			console.error('API request failed:', error);
			throw error;
		}
	}

	// Health check
	async healthCheck() {
		return this.request('/health');
	}

	// Polls API
	async getPolls(): Promise<PollResponse[]> {
		return this.request('/api/polls');
	}

	async getPoll(id: number): Promise<PollResponse> {
		return this.request(`/api/polls/${id}`);
	}

	async createPoll(poll: PollCreate): Promise<PollResponse> {
		return this.request('/api/polls', {
			method: 'POST',
			body: JSON.stringify(poll)
		});
	}

	async vote(pollId: number, position: number, additionalData?: any): Promise<PollResponse> {
		const voteData = additionalData || { position };
		return this.request(`/api/polls/${pollId}/vote`, {
			method: 'POST',
			body: JSON.stringify(voteData)
		});
	}

	async deletePoll(pollId: number): Promise<void> {
		return this.request(`/api/polls/${pollId}`, {
			method: 'DELETE'
		});
	}

	// Tier Lists API
	async getTierLists(): Promise<TierListResponse[]> {
		return this.request('/api/tierlists');
	}

	async getTierList(id: number): Promise<TierListResponse> {
		return this.request(`/api/tierlists/${id}`);
	}

	async createTierList(tierList: TierListCreate): Promise<TierListResponse> {
		return this.request('/api/tierlists', {
			method: 'POST',
			body: JSON.stringify(tierList)
		});
	}

	async updateTierListPlacements(
		tierListId: number,
		update: TierListUpdate
	): Promise<TierListResponse> {
		return this.request(`/api/tierlists/${tierListId}/placements`, {
			method: 'PUT',
			body: JSON.stringify(update)
		});
	}

	async deleteTierList(tierListId: number): Promise<void> {
		return this.request(`/api/tierlists/${tierListId}`, {
			method: 'DELETE'
		});
	}
}

export const apiClient = new ApiClient();
export default apiClient;
