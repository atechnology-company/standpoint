// i hate maths lucky i dont have to do any because the computer does it for me :))
import { db } from './firebase.js';
import {
	doc,
	getDoc,
	setDoc,
	collection,
	getDocs,
	updateDoc,
	serverTimestamp
} from 'firebase/firestore';

// User vote persistence functions
export async function saveUserVote(
	pollId: string,
	userId: string,
	position: number,
	position2D?: { x: number; y: number }
): Promise<void> {
	try {
		const userVoteRef = doc(db, 'polls', pollId, 'votes', userId);
		const voteData: any = {
			position,
			userId,
			votedAt: serverTimestamp()
		};

		if (position2D) {
			voteData.position_2d = position2D;
		}

		await setDoc(userVoteRef, voteData);
	} catch (error) {
		console.error('Error saving user vote:', error);
		throw error;
	}
}

export async function getUserVote(
	pollId: string,
	userId: string
): Promise<{ position: number; position_2d?: { x: number; y: number } } | null> {
	try {
		const userVoteRef = doc(db, 'polls', pollId, 'votes', userId);
		const voteDoc = await getDoc(userVoteRef);

		if (voteDoc.exists()) {
			const data = voteDoc.data();
			return {
				position: data.position,
				position_2d: data.position_2d || null
			};
		}

		return null;
	} catch (error) {
		console.error('Error getting user vote:', error);
		return null;
	}
}

export async function getAllVotesForPoll(pollId: string): Promise<{
	vote_positions: number[];
	vote_positions_2d: { x: number; y: number }[];
	total_votes: number;
}> {
	try {
		const votesCollection = collection(db, 'polls', pollId, 'votes');
		const votesSnapshot = await getDocs(votesCollection);

		const vote_positions: number[] = [];
		const vote_positions_2d: { x: number; y: number }[] = [];

		votesSnapshot.forEach((doc) => {
			const data = doc.data();
			if (typeof data.position === 'number') {
				vote_positions.push(data.position);
			}
			if (
				data.position_2d &&
				typeof data.position_2d.x === 'number' &&
				typeof data.position_2d.y === 'number'
			) {
				vote_positions_2d.push(data.position_2d);
			}
		});

		return {
			vote_positions,
			vote_positions_2d,
			total_votes: votesSnapshot.size
		};
	} catch (error) {
		console.error('Error getting all votes for poll:', error);
		return {
			vote_positions: [],
			vote_positions_2d: [],
			total_votes: 0
		};
	}
}

export async function updatePollStatistics(pollId: string): Promise<void> {
	try {
		const votesData = await getAllVotesForPoll(pollId);
		const { vote_positions, vote_positions_2d } = votesData;

		// Calculate statistics
		let average = 0;
		let average_2d: [number, number] | null = null;
		let std_dev = 0;

		// For 2D positions
		let median_x = 0;
		let median_y = 0;
		let mode_x = 0;
		let mode_y = 0;
		let range_x = 0;
		let range_y = 0;

		if (vote_positions.length > 0) {
			// Calculate 1D average
			average = vote_positions.reduce((sum, pos) => sum + pos, 0) / vote_positions.length;

			// Calculate standard deviation
			const variance =
				vote_positions.reduce((sum, pos) => sum + Math.pow(pos - average, 2), 0) /
				vote_positions.length;
			std_dev = Math.sqrt(variance);
		}

		if (vote_positions_2d.length > 0) {
			// Extract x and y coordinates
			const x_values = vote_positions_2d.map((pos) => pos.x);
			const y_values = vote_positions_2d.map((pos) => pos.y);

			// Calculate 2D average
			const avgX = x_values.reduce((sum, x) => sum + x, 0) / x_values.length;
			const avgY = y_values.reduce((sum, y) => sum + y, 0) / y_values.length;
			average_2d = [avgX, avgY];

			// Calculate median
			const sorted_x = [...x_values].sort((a, b) => a - b);
			const sorted_y = [...y_values].sort((a, b) => a - b);

			const mid = Math.floor(sorted_x.length / 2);
			if (sorted_x.length % 2 === 0) {
				median_x = (sorted_x[mid - 1] + sorted_x[mid]) / 2;
				median_y = (sorted_y[mid - 1] + sorted_y[mid]) / 2;
			} else {
				median_x = sorted_x[mid];
				median_y = sorted_y[mid];
			}

			// Calculate mode
			const x_frequency: Record<number, number> = {};
			const y_frequency: Record<number, number> = {};

			x_values.forEach((x) => {
				x_frequency[x] = (x_frequency[x] || 0) + 1;
			});

			y_values.forEach((y) => {
				y_frequency[y] = (y_frequency[y] || 0) + 1;
			});

			let max_x_freq = 0;
			let max_y_freq = 0;

			for (const [x, freq] of Object.entries(x_frequency)) {
				if (freq > max_x_freq) {
					max_x_freq = freq;
					mode_x = parseFloat(x);
				}
			}

			for (const [y, freq] of Object.entries(y_frequency)) {
				if (freq > max_y_freq) {
					max_y_freq = freq;
					mode_y = parseFloat(y);
				}
			}

			// Calculate range
			range_x = Math.max(...x_values) - Math.min(...x_values);
			range_y = Math.max(...y_values) - Math.min(...y_values);
		}

		// Update poll document with new statistics
		const pollRef = doc(db, 'polls', pollId);
		const statsUpdate: any = {
			stats: {
				vote_positions,
				vote_positions_2d,
				average,
				stdDev: std_dev,
				total_votes: votesData.total_votes,
				...(average_2d && {
					average2D: average_2d,
					median_x,
					median_y,
					mode_x,
					mode_y,
					range_x,
					range_y
				})
			},
			updated_at: serverTimestamp()
		};

		await updateDoc(pollRef, statsUpdate);
	} catch (error) {
		console.error('Error updating poll statistics:', error);
		throw error;
	}
}
