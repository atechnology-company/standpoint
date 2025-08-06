import { writable } from 'svelte/store';

export const accentColor = writable<string>('orange');

export const accentCss = writable<string>('255, 107, 53');

export function setAccent(color: string) {
	accentColor.set(color);
	let css = '255, 107, 53';
	if (color === 'blue') css = '59, 130, 246';
	else if (color === 'purple') css = '139, 92, 246';
	else if (color === 'green') css = '16, 185, 129';
	else if (color === 'red') css = '239, 68, 68';
	accentCss.set(css);
	document.documentElement.style.setProperty('--primary', css);
}
