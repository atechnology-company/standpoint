import { firebaseFallbackClient } from './firebase-fallback';

class ApiClient {
	async healthCheck() {
		return firebaseFallbackClient.healthCheck();
	}

	async getPolls() {
		return firebaseFallbackClient.getPolls();
	}

	async getPoll(id: string) {
		return firebaseFallbackClient.getPoll(id);
	}

	async createPoll(poll: import('./types').PollCreate) {
		return firebaseFallbackClient.createPoll(poll);
	}

	async vote(
		pollId: string,
		position: number,
		additionalData?: import('./types').VoteCreate | Record<string, unknown>
	) {
		return firebaseFallbackClient.vote(pollId, position, additionalData);
	}

	async deletePoll(pollId: string) {
		return firebaseFallbackClient.deletePoll(pollId);
	}

	async getTierLists() {
		return firebaseFallbackClient.getTierLists();
	}

	async getTierList(id: string) {
		return firebaseFallbackClient.getTierList(id);
	}

	async createTierList(tierList: import('./types').TierListCreate) {
		return firebaseFallbackClient.createTierList(tierList);
	}

	async updateTierListPlacements(tierListId: string, update: import('./types').TierListUpdate) {
		return firebaseFallbackClient.updateTierList(tierListId, update);
	}

	async deleteTierList(tierListId: string) {
		return firebaseFallbackClient.deleteTierList(tierListId);
	}

	async updateTierList(id: string, tierList: any) {
		return firebaseFallbackClient.updateTierList(id, tierList);
	}
}

export const apiClient = new ApiClient();
export { apiClient as default };
