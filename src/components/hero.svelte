<script lang="ts">
	import { onMount } from 'svelte';

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
	let autoplayInterval: ReturnType<typeof setInterval>;
	let pauseAutoplay = false;

	onMount(() => {
		if (slides.length === 0) {
			startAutoplay();

			return () => {
				if (autoplayInterval) clearInterval(autoplayInterval);
			};
		}
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

	function startAutoplay() {
		if (autoplayInterval) clearInterval(autoplayInterval);
		autoplayInterval = setInterval(() => {
			if (!pauseAutoplay) {
				nextSlide();
			}
		}, 10000);
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
	{#each slides as slide, i}
		<div
			class="pointer-events-none absolute top-0 left-0 h-full w-full bg-cover bg-center opacity-0 transition-opacity duration-500"
			class:opacity-100={i === currentSlide}
			class:pointer-events-auto={i === currentSlide}
			style="background-color: {slide.backgroundColor || '#AADDEE'}; {slide.image
				? `background-image: url('${slide.image}');`
				: ''}"
		>
			<div
				class="bg-opacity-40 absolute top-0 left-0 z-10 h-full w-full bg-black backdrop-blur-sm"
			></div>

			<div
				class="font-space-grotesk relative z-20 flex h-full w-full flex-col justify-between p-8 text-white"
			>
				<div class="flex w-full justify-between">
					<div class="flex gap-4">
						<span class="author">{slide.author || 'Sean Combs'}</span>
						<span class="date">{slide.date || '1989-06-04'}</span>
						<span class="revision">Rev.{slide.revision || '0'}</span>
					</div>
					<div class="flex gap-4">
						<span class="likes">{slide.likes || 0} ♥</span>
						<span class="comments">{slide.comments || 0} ✎</span>
						<span class="forks">{slide.forks || 0} ⑂</span>
					</div>
				</div>

				<div class="mt-auto mb-8 self-start">
					<h2 class="mb-2 text-3xl font-bold opacity-50">TRENDING NOW</h2>
					<h1 class="m-0 text-5xl font-bold">{slide.header || ''}</h1>
				</div>

				<div class="flex gap-2 self-end">
					{#each slides as _, index}
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
