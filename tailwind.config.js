/** @type {import('tailwindcss').Config} */
const { colors } = require('tailwindcss/colors');

module.exports = {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		colors: {
			leuchtorange: '#ff5705',
			transparent: 'transparent',
			current: 'currentColor',
			black: '#000000',
			white: '#ffffff',
			gray: {
				50: '#999999',
				100: '#898989',
				200: '#797979',
				300: '#696969',
				400: '#595959',
				500: '#494949',
				600: '#393939',
				700: '#292929',
				800: '#191919',
				900: '#090909'
			},
			red: {
				200: '#fecaca',
				500: '#ef4444',
				600: '#dc2626',
				700: '#b91c1c'
			},
			blue: {
				400: '#60a5fa',
				500: '#3b82f6'
			},
			orange: {
				300: '#fdba74',
				500: '#f97316',
				900: '#9a3412'
			}
		},
		fontFamily: {
			sans: [
				'Space Grotesk',
				'-apple-system',
				'BlinkMacSystemFont',
				'Segoe UI',
				'Roboto',
				'sans-serif'
			]
		},
		extend: {}
	},
	plugins: []
};
