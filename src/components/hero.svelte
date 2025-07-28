<script lang="ts">
	import { onMount } from 'svelte';
	import type { TierListResponse } from '../lib/api';
	let pauseAutoplay = false;
	type Slide = {
		header: string;
		author: string;
		date: string;
		revision: number;
		likes: number;
		comments: number;
		forks: number;
		image?: string;
		backgroundColor?: string;
		tierlist?: TierListResponse;
	};

	export let slides: Array<Slide> = [];

	// TODO: Replace all 'any' types with more specific types throughout this file.
	// TODO: Add 'key' to each {#each} block as required by Svelte.

	let currentSlide = 0;
	let startX = 0;
	let isDragging = false;
	let carouselElement: HTMLElement;

	// Like counts for each slide
	let slideLikes: number[] = [];

	onMount(async () => {
		// Only fetch likes if slides have tierlist with id
		slideLikes = slides.map((slide) => slide.likes || 0);
		await Promise.all(
			slides.map(async (slide, i) => {
				if (slide.tierlist && slide.tierlist.id) {
					try {
						const res = await fetch(`/api/interactions/tierlist/${slide.tierlist.id}/likes`);
						if (res.ok) {
							const data = await res.json();
							slideLikes[i] = data.likes ?? 0;
							slide.likes = data.likes ?? 0;
						}
					} catch {
						// ignore error
					}
				}
			})
		);
	});

	function goToSlide(index: number) {
		if (index < 0) {
			currentSlide = slides.length - 1;
		} else if (index >= slides.length) {
			currentSlide = 0;
		} else {
			currentSlide = index;
		}
	}

	function nextSlide() {
		goToSlide(currentSlide + 1);
	}

	function prevSlide() {
		goToSlide(currentSlide - 1);
	}

	function handleTouchStart(e: TouchEvent) {
		startDrag(e.touches[0].clientX);
		pauseAutoplay = true;
	}

	function handleMouseDown(e: MouseEvent) {
		startDrag(e.clientX);
		pauseAutoplay = true;
	}

	function startDrag(clientX: number) {
		isDragging = true;
		startX = clientX;
	}

	function handleTouchMove(e: TouchEvent) {
		if (!isDragging) return;
		handleDragMove(e.touches[0].clientX);
	}

	function handleMouseMove(e: MouseEvent) {
		if (!isDragging) return;
		handleDragMove(e.clientX);
	}

	function handleDragMove(clientX: number) {
		if (!isDragging) return;

		const diff = startX - clientX;
		const threshold = 50;

		if (Math.abs(diff) > threshold) {
			if (diff > 0) {
				nextSlide();
			} else {
				prevSlide();
			}
			isDragging = false;
		}
	}

	function handleTouchEnd(e: TouchEvent) {
		endDrag(e.changedTouches[0].clientX);
	}

	function handleMouseUp(e: MouseEvent) {
		endDrag(e.clientX);
	}

	function endDrag(clientX: number) {
		if (!isDragging) return;

		isDragging = false;
		const diff = startX - clientX;
		const threshold = 50;

		if (Math.abs(diff) > threshold) {
			if (diff > 0) {
				nextSlide();
			} else {
				prevSlide();
			}
		}

		setTimeout(() => {
			pauseAutoplay = false;
		}, 3000);
	}

	function handleMouseLeave() {
		if (isDragging) {
			isDragging = false;
			setTimeout(() => {
				pauseAutoplay = false;
			}, 3000);
		}
	}
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
	class="relative h-[70vh] w-full cursor-grab touch-pan-y overflow-hidden active:cursor-grabbing"
	bind:this={carouselElement}
	on:touchstart={handleTouchStart}
	on:touchmove={handleTouchMove}
	on:touchend={handleTouchEnd}
	on:mousedown={handleMouseDown}
	on:mousemove={handleMouseMove}
	on:mouseup={handleMouseUp}
	on:mouseleave={handleMouseLeave}
>
	{#each slides as slide, i (slide.header)}
		<div
			class="pointer-events-none absolute top-0 left-0 h-full w-full bg-cover bg-center opacity-0 transition-opacity duration-500"
			class:opacity-100={i === currentSlide}
			class:pointer-events-auto={i === currentSlide}
			style="background-color: {slide.backgroundColor || '#AADDEE'}; {slide.image
				? `background-image: url('${slide.image}');`
				: ''}"
		>
			<div class="bg-opacity-40 absolute top-0 left-0 z-10 h-full w-full bg-black backdrop-blur-sm">
				<div class="flex items-center gap-4">
					<!-- Like Icon -->
					<div
						class="group flex items-center"
						style="background: none; border: none; padding: 0;"
						aria-label="Like"
					>
						<span
							class="material-symbols-outlined text-2xl transition-colors select-none"
							style="color: {slide.likes > 0
								? '#ff5705'
								: '#fff'}; font-family: 'Material Symbols Outlined'; font-variation-settings: 'FILL' {slide.likes >
							0
								? 1
								: 0}, 'wght' 600, 'GRAD' 0, 'opsz' 24;"
						>
							favorite
						</span>
						<span class="ml-1">{slide.likes || 0}</span>
					</div>
					<!-- Comments Icon -->
					<span class="flex items-center">
						<span
							class="material-symbols-outlined text-2xl"
							style="color: #fff; font-family: 'Material Symbols Outlined'; font-variation-settings: 'FILL' 0, 'wght' 600, 'GRAD' 0, 'opsz' 24;"
						>
							chat_bubble
						</span>
						<span class="ml-1">{slide.comments || 0}</span>
					</span>
					<!-- Forks Icon -->
					<span class="flex items-center">
						<span
							class="material-symbols-outlined text-2xl"
							style="color: #fff; font-family: 'Material Symbols Outlined'; font-variation-settings: 'FILL' 0, 'wght' 600, 'GRAD' 0, 'opsz' 24;"
						>
							fork_right
						</span>
						<span class="ml-1">{slide.forks || 0}</span>
					</span>
				</div>

				<div class="mt-auto mb-8 self-start">
					<h2 class="mb-2 text-3xl font-bold opacity-50">TRENDING NOW</h2>
					<h1 class="m-0 text-5xl font-bold">{slide.header || ''}</h1>
				</div>

				<div class="flex gap-2 self-end">
					{#each slides as _, index (index)}
						<button
							class="h-4 w-4 cursor-pointer border-none p-0 transition-all duration-300"
							class:opacity-50={index !== currentSlide}
							class:hover:opacity-70={index !== currentSlide}
							style={index === currentSlide
								? 'background-color: #ff5705; width: 36px;'
								: 'background-color: rgba(255, 255, 255, 0.5);'}
							on:click={() => goToSlide(index)}
							aria-label="Go to slide {index + 1}"
						></button>
					{/each}
				</div>
			</div>
		</div>
	{/each}
</div>
