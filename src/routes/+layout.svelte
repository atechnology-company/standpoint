<script lang="ts">
	import '../app.css';
	import Header from '../components/header.svelte';
	import Onboarding from '../components/onboarding.svelte';
	let { children } = $props();

	import { writable } from 'svelte/store';
	import { setContext } from 'svelte';
	import { fade } from 'svelte/transition';

	const navHoverStore = writable(false);
	setContext('navHover', navHoverStore);

	let showOnboarding = $state(false);

	function handleOnboardingComplete() {
		showOnboarding = false;
	}
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" />
	<link href="https://fonts.googleapis.com/css2?family=Mozilla+Text:wght@200..700&display=swap" rel="stylesheet">
	<link
		href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
		rel="stylesheet"
	/>
</svelte:head>

<main class="h-full w-full bg-black font-sans">
	<Header />
	{#if $navHoverStore}
		<div
			class="pointer-events-none fixed inset-0 z-40 bg-black opacity-90"
			transition:fade={{ duration: 300 }}
		></div>
	{/if}
	{@render children()}

	<!-- Onboarding Component -->
	<Onboarding bind:show={showOnboarding} on:complete={handleOnboardingComplete} />
</main>

<style global>
	:root {
		--default-font-family: "Mozilla Text", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, "Noto Sans", sans-serif;
		--font-sans: "Mozilla Text", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, "Noto Sans", sans-serif;
	}
	body, html, :host {
		font-family: "Mozilla Text", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, "Noto Sans", sans-serif !important;
	}
</style>

