export interface Badge {
	id: string;
	name: string;
	description: string;
	icon: string;
	color: string;
	borderColor: string;
	requirement: (stats: UserStats) => boolean;
}

export interface UserStats {
	aura: number;
	followers: number;
	following: number;
	pollsCreated: number;
	tierlistsCreated: number;
	totalVotes: number;
	pro: boolean;
	dev: boolean;
	accountAge: number;
}

// Available badges
export const BADGES: Badge[] = [
	{
		id: 'pro',
		name: 'Pro',
		description: 'Standpoint Pro subscriber',
		icon: '✨',
		// Use theme-based gradient for Pro so it responds to user's selected accents
		color: 'linear-gradient(90deg, rgb(var(--primary)), rgb(var(--secondary)))',
		// borderColor as CSS value so components can apply it directly
		borderColor: 'rgb(var(--primary))',
		requirement: (stats) => stats.pro
	},
	{
		id: 'dev',
		name: 'Developer',
		description: 'Standpoint Developer',
		icon: '⚡',
		color: 'linear-gradient(90deg, rgb(var(--secondary)), rgb(var(--primary)))',
		borderColor: 'rgb(var(--secondary))',
		requirement: (stats) => stats.dev
	}
];

export function getUserBadges(stats: UserStats): Badge[] {
	return BADGES.filter((badge) => badge.requirement(stats));
}

export function getBadgeById(id: string): Badge | undefined {
	return BADGES.find((badge) => badge.id === id);
}
