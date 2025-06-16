<script lang="ts">
	import '../app.css';
	import Header from '../components/header.svelte';
	let { children } = $props();

	import { writable } from 'svelte/store';
	import { setContext } from 'svelte';
	import { fade } from 'svelte/transition';

	const navHoverStore = writable(false);
	setContext('navHover', navHoverStore);
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" />
	<link
		href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&display=swap"
		rel="stylesheet"
	/>
	<link
		href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined"
		rel="stylesheet"
	/>
</svelte:head>

<main class="h-full w-full bg-black">
	<Header />
	{#if $navHoverStore}
		<div
			class="pointer-events-none fixed inset-0 z-40 bg-black opacity-90"
			transition:fade={{ duration: 300 }}
		></div>
	{/if}
	{@render children()}
</main>
