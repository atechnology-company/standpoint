import { error } from '@sveltejs/kit';
import {
	getUserProfile,
	getFollowerCount,
	getFollowingCount,
	createUserProfile,
	resolveUid,
	type UserProfile
} from '../../../lib/user-profile.js';
import {
	getUserTierlists,
	getUserPolls,
	type TierlistData,
	type PollData
} from '../../../lib/firestore-polls-tierlists.js';
import { browser } from '$app/environment';

export async function load({ params }: { params: { uid: string } }) {
	try {
		const userId = params.uid;

		if (!userId) {
			throw error(400, 'User ID is required');
		}

		const resolvedUserId = await resolveUid(userId);

		if (!browser) {
			try {
				const userProfile = await getUserProfile(resolvedUserId);
				if (!userProfile) {
					throw error(404, `User not found`);
				}
				return {
					userProfile,
					followerCount: 0,
					followingCount: 0,
					userTierlists: [],
					userPolls: []
				};
			} catch (err) {
				throw error(404, `User not found`);
			}
		}

		let userProfile = await getUserProfile(resolvedUserId);
		if (!userProfile) {
			throw error(404, `User not found`);
		}

		// Get social stats and user creations using resolved UID
		const [followerCount, followingCount, userTierlists, userPolls] = await Promise.all([
			getFollowerCount(resolvedUserId),
			getFollowingCount(resolvedUserId),
			getUserTierlists(resolvedUserId),
			getUserPolls(resolvedUserId)
		]);

		return {
			userProfile,
			followerCount,
			followingCount,
			userTierlists,
			userPolls,
			requestedUid: params.uid,
			resolvedUid: resolvedUserId
		};
	} catch (err: any) {
		console.error('Profile page load error:', err);
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		throw error(500, 'Failed to load profile');
	}
}
