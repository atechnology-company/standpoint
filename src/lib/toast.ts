import { writable } from 'svelte/store';

export interface Toast {
	id: string;
	message: string;
	type: 'success' | 'error' | 'warning' | 'info';
	duration?: number;
}

export const toasts = writable<Toast[]>([]);

export function addToast(message: string, type: Toast['type'] = 'info', duration = 5000) {
	const id = Math.random().toString(36).substr(2, 9);
	const toast: Toast = { id, message, type, duration };

	toasts.update((currentToasts) => [...currentToasts, toast]);

	if (duration > 0) {
		setTimeout(() => {
			removeToast(id);
		}, duration);
	}

	return id;
}

export function removeToast(id: string) {
	toasts.update((currentToasts) => currentToasts.filter((toast) => toast.id !== id));
}
