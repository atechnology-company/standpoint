<script lang="ts">
	import { onMount } from 'svelte';
	import type { TierListResponse } from '$lib/types';
	import { goto } from '$app/navigation';
	import { fadeImage } from '$lib/fadeImage';

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
		tierlist?: any;
	};

	export let slides: Array<Slide> = [];

	let currentSlide = 0;
	let startX = 0;
	let isDragging = false;
	let carouselElement: HTMLElement;

	// Shuffle slides on mount
	function shuffleSlides(arr: Array<Slide>) {
		let array = arr.slice();
		for (let i = array.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[array[i], array[j]] = [array[j], array[i]];
		}
		return array;
	}

	onMount(async () => {
		slides = shuffleSlides(slides);
		startAutoplay();
	});

	function startAutoplay() {
		setInterval(() => {
			if (!pauseAutoplay && !isDragging) {
				nextSlide();
			}
		}, 6000);
	}

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
	}

	function handleMouseLeave() {
		if (isDragging) {
			isDragging = false;
			setTimeout(() => {
				pauseAutoplay = false;
			}, 3000);
		}
	}

	function navigateToTierlist() {
		if (slides[currentSlide]?.tierlist?.id) {
			goto(`/tierlists/${slides[currentSlide].tierlist.id}`);
		}
	}
</script>

<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
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
	role="group"
	aria-roledescription="carousel"
	aria-label="Featured tierlists carousel"
	tabindex="0"
>
	{#each slides as slide, i (slide.tierlist?.id || `${slide.header}-${slide.author}-${i}`)}
		<div
			class="pointer-events-none absolute top-0 left-0 h-full w-full opacity-0 transition-opacity duration-500"
			class:opacity-100={i === currentSlide}
			class:pointer-events-auto={i === currentSlide}
			style="background-color: {slide.backgroundColor || '#AADDEE'};"
			on:click={navigateToTierlist}
			on:keydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') navigateToTierlist();
			}}
			tabindex="0"
			role="button"
			aria-label="View tierlist {slide.header}"
		>
			{#if slide.image}
				<img
					use:fadeImage
					src={slide.image}
					alt={slide.header}
					class="sp-fade-image absolute inset-0 h-full w-full object-cover"
					decoding="async"
					loading="lazy"
					draggable="false"
				/>
			{/if}
			<!-- Dark overlay -->
			<div
				class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-black/40 backdrop-blur-sm"
			>
				<div class="flex h-full flex-col justify-between p-6">
					<!-- Top metadata -->
					<div class="flex items-center justify-between text-white">
						<div class="flex items-center gap-4">
							<div class="flex items-center gap-1">
								<span
									class="material-symbols-outlined text-2xl"
									style="color: {slide.likes > 0
										? 'rgb(var(--primary))'
										: '#fff'}; font-variation-settings: 'FILL' {slide.likes > 0
										? 1
										: 0}, 'wght' 600;"
								>
									favorite
								</span>
								<span>{slide.likes || 0}</span>
							</div>
							<div class="flex items-center gap-1">
								<span
									class="material-symbols-outlined text-2xl"
									style="font-variation-settings: 'FILL' 0, 'wght' 600;">chat_bubble</span
								>
								<span>{slide.comments || 0}</span>
							</div>
							<div class="flex items-center gap-1">
								<span
									class="material-symbols-outlined text-2xl"
									style="font-variation-settings: 'FILL' 0, 'wght' 600;">call_split</span
								>
								<span>{slide.forks || 0}</span>
							</div>
						</div>
						<div><span class="text-sm">{slide.date}</span></div>
					</div>
					<div class="my-auto text-left text-white">
						<p class="text-xl">{slide.author}</p>
						<h1 class="mb-2 cursor-pointer text-6xl font-bold">{slide.header}</h1>
					</div>
				</div>
			</div>
		</div>
	{/each}
	{#if slides.length > 1}
		<div class="pointer-events-auto absolute right-6 bottom-6 z-30 flex items-center gap-2">
			{#each slides as _, index (index)}
				<button
					class="h-4 transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 {index ===
					currentSlide
						? 'bg-accent w-8'
						: 'w-4 bg-white/40'}"
					aria-label="Go to slide {index + 1}"
					aria-current={index === currentSlide}
					on:click={(e) => {
						e.stopPropagation();
						goToSlide(index);
					}}
					on:keydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							goToSlide(index);
						}
					}}
				></button>
			{/each}
		</div>
	{/if}
</div>
