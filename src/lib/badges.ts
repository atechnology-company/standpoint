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
		color: 'from-yellow-400 to-orange-500',
		borderColor: 'border-yellow-400',
		requirement: (stats) => stats.pro
	},
	{
		id: 'dev',
		name: 'Developer',
		description: 'Standpoint Developer',
		icon: '⚡',
		color: 'from-cyan-400 to-blue-500',
		borderColor: 'border-cyan-400',
		requirement: (stats) => stats.dev
	}
];

export function getUserBadges(stats: UserStats): Badge[] {
	return BADGES.filter((badge) => badge.requirement(stats));
}

export function getBadgeById(id: string): Badge | undefined {
	return BADGES.find((badge) => badge.id === id);
}
