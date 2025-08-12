import { writable } from 'svelte/store';
import { db } from './firebase';
import { get } from 'svelte/store';
import { currentUser } from './stores';
import { doc, setDoc } from 'firebase/firestore';

export const accentColor = writable<string>('orange');

export const accentCss = writable<string>('255, 107, 53');

export async function setAccent(color: string) {
	accentColor.set(color);
	let css = '255, 107, 53'; // default leuchtorange #FF6B35)
	let cssLight = '255, 180, 120'; // #FFB478
	if (color === 'blue') {
		css = '0, 255, 255'; // #00FFFF
		cssLight = '120, 255, 255'; // #78FFFF
	} else if (color === 'purple') {
		css = '180, 0, 255'; // #B400FF
		cssLight = '210, 120, 255'; // #D278FF
	} else if (color === 'green') {
		css = '5, 255, 172'; // #05FFAC
		cssLight = '120, 255, 200'; // #78FFC8
	} else if (color === 'red') {
		css = '255, 53, 107'; // #FF356B
		cssLight = '255, 120, 180'; // #FF78B4
	} else if (color === 'lime') {
		css = '192, 255, 5'; // #C0FF05
		cssLight = '220, 255, 120'; // #DCFF78
	}
	accentCss.set(css);
	document.documentElement.style.setProperty('--primary', css);
	document.documentElement.style.setProperty('--primary-light', cssLight);

	document.documentElement.style.setProperty('--primary-rgb', css);
	document.documentElement.style.setProperty('--primary-light-rgb', cssLight);
	const [r, g, b] = css.split(',').map((v) => v.trim());
	const [rl, gl, bl] = cssLight.split(',').map((v) => v.trim());
	document.documentElement.style.setProperty('--primary-soft', `${r}, ${g}, ${b}, 0.12`);
	document.documentElement.style.setProperty('--primary-light-soft', `${rl}, ${gl}, ${bl}, 0.18`);

	// Dynamic PRO gradient stops derived from accent hue so gradients feel color-specific
	try {
		const { h, s, l } = rgbToHsl(Number(r), Number(g), Number(b));
		const stop1 = `hsl(${h} ${Math.min(s + 10, 100)}% ${Math.max(l - 4, 18)}%)`;
		const stop2 = `hsl(${(h + 40) % 360} ${s}% ${Math.max(l - 10, 15)}%)`;
		const stop3 = `hsl(${(h + 70) % 360} ${Math.max(s - 5, 35)}% ${Math.max(l - 16, 12)}%)`;
		document.documentElement.style.setProperty('--pro-grad-stop-1', stop1);
		document.documentElement.style.setProperty('--pro-grad-stop-2', stop2);
		document.documentElement.style.setProperty('--pro-grad-stop-3', stop3);
	} catch {}

	// Persist preference for logged-in user
	try {
		const user = get(currentUser);
		if (user) {
			await setDoc(doc(db, 'users', user.uid), { preferences: { accent: color } }, { merge: true });
		}
	} catch (e) {
		console.warn('Failed to persist accent preference', e);
	}
}

function rgbToHsl(r: number, g: number, b: number) {
	r /= 255;
	g /= 255;
	b /= 255;
	const max = Math.max(r, g, b),
		min = Math.min(r, g, b);
	let h = 0,
		s = 0;
	const l = (max + min) / 2;
	if (max !== min) {
		const d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		switch (max) {
			case r:
				h = (g - b) / d + (g < b ? 6 : 0);
				break;
			case g:
				h = (b - r) / d + 2;
				break;
			case b:
				h = (r - g) / d + 4;
				break;
		}
		h /= 6;
	}
	return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}
