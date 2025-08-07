<script context="module" lang="ts">
	export type ChartData = {
		poll: {
			response_type: number;
			gradients?: { enabled?: boolean; colors: string[] };
			options: string[];
			user_vote?: number | null;
			user_vote_2d?: { x: number; y: number } | null;
		};
		positions: number[];
		positions2D?: Array<{ x: number; y: number; id?: string }>;
		average: number;
		average2D?: [number, number];
		stdDev: number;
		lowerBound: number;
		upperBound: number;
	};
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';

	export let chartData: ChartData;
	export let onVote: (position: number, position2D?: { x: number; y: number }) => void;

	let shapeType = 'line';
	$: {
		if (chartData?.poll?.response_type) {
			switch (chartData.poll.response_type) {
				case 2:
					shapeType = 'line';
					break;
				case 3:
					shapeType = 'triangle';
					break;
				case 4:
					shapeType = 'square';
					break;
				case 5:
					shapeType = 'pentagon';
					break;
				default:
					shapeType = 'line';
			}
		}
	}

	let showSavedMessage = false;
	let isDragging = false;
	let svgRef: SVGSVGElement;
	let heatmapEnabled = true;
	let dragging2DPosition: { x: number; y: number } | null = null;
	let userHasVoted = !!chartData?.poll?.user_vote;
	let userHasVoted2D = !!chartData?.poll?.user_vote_2d;
	let lastPosition: number | null = null;
	let lastPosition2D: { x: number; y: number } | null = null;
	function renderGradients(responseType: number) {
		if (!chartData?.poll?.gradients?.enabled) return [];

		const gradientConfigs: Record<number, Array<{ cx: string; cy: string }>> = {
			// Line has just two endpoints
			2: [
				{ cx: '5%', cy: '50%' },
				{ cx: '95%', cy: '50%' }
			],
			// Triangle corners
			3: [
				{ cx: '50%', cy: '5%' },
				{ cx: '5%', cy: '85%' },
				{ cx: '95%', cy: '85%' }
			],
			// Square corners
			4: [
				{ cx: '5%', cy: '5%' },
				{ cx: '95%', cy: '5%' },
				{ cx: '95%', cy: '95%' },
				{ cx: '5%', cy: '95%' }
			],
			// Pentagon corners
			5: [
				{ cx: '50%', cy: '5%' },
				{ cx: '90%', cy: '30%' },
				{ cx: '80%', cy: '85%' },
				{ cx: '20%', cy: '85%' },
				{ cx: '10%', cy: '30%' }
			]
		};

		return gradientConfigs[responseType] || [];
	}

	function getShapePoints(scale = 1, rotation = 0): Array<{ x: number; y: number; label: string }> {
		const centerX = 0.5;
		const centerY = 0.5;
		const points = [];

		if (shapeType === 'line') {
			return [
				{ x: 0.05, y: 0.5, label: chartData.poll.options[0] },
				{ x: 0.95, y: 0.5, label: chartData.poll.options[1] }
			];
		} else if (shapeType === 'triangle') {
			const radius = 0.35 * scale;
			for (let i = 0; i < 3; i++) {
				const angle = (i * 2 * Math.PI) / 3 + rotation - Math.PI / 2;
				points.push({
					x: centerX + radius * Math.cos(angle),
					y: centerY + radius * Math.sin(angle),
					label: chartData.poll.options[i]
				});
			}
		} else if (shapeType === 'square') {
			const radius = 0.3 * scale;
			for (let i = 0; i < 4; i++) {
				const angle = (i * Math.PI) / 2 + rotation + Math.PI / 4;
				points.push({
					x: centerX + radius * Math.cos(angle),
					y: centerY + radius * Math.sin(angle),
					label: chartData.poll.options[i]
				});
			}
		} else if (shapeType === 'pentagon') {
			const radius = 0.35 * scale;
			for (let i = 0; i < 5; i++) {
				const angle = (i * 2 * Math.PI) / 5 + rotation - Math.PI / 2;
				points.push({
					x: centerX + radius * Math.cos(angle),
					y: centerY + radius * Math.sin(angle),
					label: chartData.poll.options[i]
				});
			}
		}

		return points;
	}

	function handleVote(e: MouseEvent) {
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const x = (e.clientX - rect.left) / rect.width;
		const y = (e.clientY - rect.top) / rect.height;

		const boundedX = Math.max(0, Math.min(1, x));
		const boundedY = Math.max(0, Math.min(1, y));

		if (chartData.poll.response_type === 2) {
			lastPosition = boundedX;
			submitVote();
		} else {
			lastPosition2D = { x: boundedX, y: boundedY };
			submitVote();
		}
	}

	function handlePointerDown(e: PointerEvent) {
		if (chartData.poll.response_type >= 3) {
			isDragging = true;
			const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
			const x = (e.clientX - rect.left) / rect.width;
			const y = (e.clientY - rect.top) / rect.height;

			dragging2DPosition = {
				x: Math.max(0, Math.min(1, x)),
				y: Math.max(0, Math.min(1, y))
			};
		}
	}

	function handlePointerMove(e: PointerEvent) {
		if (isDragging && chartData.poll.response_type >= 3) {
			const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
			const x = (e.clientX - rect.left) / rect.width;
			const y = (e.clientY - rect.top) / rect.height;

			dragging2DPosition = {
				x: Math.max(0, Math.min(1, x)),
				y: Math.max(0, Math.min(1, y))
			};
		}
	}

	function handlePointerUp(e: PointerEvent) {
		if (isDragging && chartData.poll.response_type >= 3) {
			isDragging = false;
			const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
			const x = (e.clientX - rect.left) / rect.width;
			const y = (e.clientY - rect.top) / rect.height;

			lastPosition2D = {
				x: Math.max(0, Math.min(1, x)),
				y: Math.max(0, Math.min(1, y))
			};
			dragging2DPosition = null;
			submitVote();
		}
	}

	function submitVote() {
		if (chartData.poll.response_type >= 3) {
			if (lastPosition2D !== null) {
				onVote(lastPosition2D.x, lastPosition2D);
				lastPosition2D = null;
			}
		} else {
			if (lastPosition !== null) {
				onVote(lastPosition);
				lastPosition = null;
			}
		}

		showSavedMessage = true;
		setTimeout(() => {
			showSavedMessage = false;
		}, 1000);
	}

	function drawHeatmap() {
		if (!chartData?.positions2D || !svgRef) return;

		while (svgRef.firstChild) {
			svgRef.removeChild(svgRef.firstChild);
		}

		const shapePoints = getShapePoints();
		const shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');

		let pathD = '';
		if (shapeType === 'line') {
			pathD = `M ${shapePoints[0].x} ${shapePoints[0].y} L ${shapePoints[1].x} ${shapePoints[1].y}`;
		} else {
			pathD =
				shapePoints.map((point, i) => `${i === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ') +
				' Z';
		}

		shape.setAttribute('d', pathD);
		shape.setAttribute('stroke', 'rgba(255, 255, 255, 0.3)');
		shape.setAttribute('stroke-width', '0.003');

		if (chartData.poll.gradients?.enabled && chartData.poll.gradients.colors) {
			const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
			const configs = renderGradients(chartData.poll.response_type);

			if (configs.length > 0 && configs.length === chartData.poll.gradients.colors.length) {
				configs.forEach((config, i) => {
					const gradientId = `corner-gradient-${i}`;
					const radialGradient = document.createElementNS(
						'http://www.w3.org/2000/svg',
						'radialGradient'
					);
					radialGradient.setAttribute('id', gradientId);
					radialGradient.setAttribute('cx', config.cx);
					radialGradient.setAttribute('cy', config.cy);
					radialGradient.setAttribute('r', '80%');

					// First stop at center of the radial gradient
					const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
					stop1.setAttribute('offset', '0%');
					stop1.setAttribute(
						'style',
						`stop-color:${chartData.poll.gradients!.colors[i]};stop-opacity:0.6`
					);

					// Middle stop
					const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
					stop2.setAttribute('offset', '70%');
					stop2.setAttribute(
						'style',
						`stop-color:${chartData.poll.gradients!.colors[i]};stop-opacity:0.1`
					);

					// Final stop - transparent
					const stop3 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
					stop3.setAttribute('offset', '100%');
					stop3.setAttribute('style', 'stop-color:transparent;stop-opacity:0');

					radialGradient.appendChild(stop1);
					radialGradient.appendChild(stop2);
					radialGradient.appendChild(stop3);
					defs.appendChild(radialGradient);

					// Create a clone of the shape to apply each gradient
					if (i > 0) {
						const newShape = shape.cloneNode(true) as SVGElement;
						newShape.setAttribute('fill', `url(#${gradientId})`);
						newShape.setAttribute('stroke', 'none');
						svgRef.appendChild(newShape);
					} else {
						// For the first gradient, apply to the original shape
						shape.setAttribute('fill', `url(#${gradientId})`);
					}
				});
			} else {
				// Fallback to original linear gradient if configs don't match colors
				const gradientId = 'shape-gradient';
				const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
				gradient.setAttribute('id', gradientId);
				gradient.setAttribute('x1', '0%');
				gradient.setAttribute('y1', '0%');
				gradient.setAttribute('x2', '100%');
				gradient.setAttribute('y2', '100%');

				chartData.poll.gradients.colors.forEach((color, i) => {
					const stop = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
					stop.setAttribute(
						'offset',
						`${(i / (chartData.poll.gradients!.colors.length - 1)) * 100}%`
					);
					stop.setAttribute('style', `stop-color:${color};stop-opacity:0.3`);
					gradient.appendChild(stop);
				});

				defs.appendChild(gradient);
				shape.setAttribute('fill', `url(#${gradientId})`);
			}

			svgRef.appendChild(defs);
		} else {
			shape.setAttribute('fill', 'rgba(255, 255, 255, 0.05)');
		}

		svgRef.appendChild(shape);

		const positions = chartData.positions2D;
		const maxDensity = Math.max(1, positions.length / 20);
		const clusters: Array<{ x: number; y: number; count: number }> = [];

		positions.forEach((pos) => {
			const found = clusters.find(
				(c) => Math.abs(c.x - pos.x) < 0.05 && Math.abs(c.y - pos.y) < 0.05
			);

			if (found) {
				found.count++;
				found.x = (found.x * (found.count - 1) + pos.x) / found.count;
				found.y = (found.y * (found.count - 1) + pos.y) / found.count;
			} else {
				clusters.push({ x: pos.x, y: pos.y, count: 1 });
			}
		});

		clusters.forEach((cluster) => {
			const opacity = Math.min(0.8, 0.3 + (cluster.count / maxDensity) * 0.5);
			const radius = 0.008 + (cluster.count / maxDensity) * 0.015;

			const point = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
			point.setAttribute('cx', cluster.x.toString());
			point.setAttribute('cy', cluster.y.toString());
			point.setAttribute('r', radius.toString());
			point.setAttribute('fill', `rgba(255, 255, 255, ${opacity})`);
			point.setAttribute('class', 'vote-point');
			svgRef.appendChild(point);
		});

		if (
			chartData.average2D &&
			Array.isArray(chartData.average2D) &&
			chartData.average2D.length === 2
		) {
			const [cx, cy] = chartData.average2D;

			if (
				typeof cx === 'number' &&
				typeof cy === 'number' &&
				!isNaN(cx) &&
				!isNaN(cy) &&
				cx >= 0 &&
				cx <= 1 &&
				cy >= 0 &&
				cy <= 1
			) {
				const avgPoint = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
				avgPoint.setAttribute('cx', cx.toString());
				avgPoint.setAttribute('cy', cy.toString());
				avgPoint.setAttribute('r', '0.025');
				avgPoint.setAttribute('fill', 'white');
				avgPoint.setAttribute('class', 'average-point');
				avgPoint.setAttribute('style', 'z-index: 1000;');
				svgRef.appendChild(avgPoint);

				if (chartData.stdDev && chartData.stdDev > 0) {
					const stdDevCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
					stdDevCircle.setAttribute('cx', cx.toString());
					stdDevCircle.setAttribute('cy', cy.toString());
					stdDevCircle.setAttribute('r', Math.min(0.4, chartData.stdDev * 1.5).toString());
					stdDevCircle.setAttribute('fill', 'none');
					stdDevCircle.setAttribute('stroke', 'rgba(255, 255, 255, 0.2)');
					stdDevCircle.setAttribute('stroke-width', '0.002');
					stdDevCircle.setAttribute('stroke-dasharray', '0.01, 0.01');
					stdDevCircle.setAttribute('style', 'z-index: 999;');
					svgRef.appendChild(stdDevCircle);
				}
			}
		}

		shapePoints.forEach((point, index) => {
			const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');

			label.setAttribute('x', point.x.toString());
			label.setAttribute('y', point.y.toString());
			label.setAttribute('text-anchor', 'middle');
			label.setAttribute('dominant-baseline', 'middle');
			label.setAttribute('fill', 'white');
			label.setAttribute('font-size', '0.04');
			label.setAttribute('font-family', 'system-ui, -apple-system, sans-serif');
			label.setAttribute('font-weight', '400');
			label.textContent = point.label;
			svgRef.appendChild(label);
		});
	}

	function toggleHeatmap() {
		heatmapEnabled = !heatmapEnabled;
		if (heatmapEnabled) {
			drawHeatmap();
		} else {
			const points = svgRef.querySelectorAll('.vote-point');
			points.forEach((point) => point.remove());
		}
	}

	onMount(() => {
		if (chartData?.poll?.response_type >= 3 && chartData?.positions2D) {
			drawHeatmap();
		}
	});

	$: if (chartData?.poll?.response_type >= 3 && chartData?.positions2D && svgRef) {
		drawHeatmap();
	}
</script>

{#if chartData.poll.response_type === 2}
	<div class="relative h-full space-y-4">
		<div
			class="relative flex h-full w-full items-center justify-center border border-gray-700 bg-gradient-to-b from-gray-900 to-black"
			on:click={handleVote}
			on:keydown={(e) => e.key === 'Enter' && e.currentTarget.click()}
			role="button"
			tabindex="0"
		>
			<svg viewBox="0 0 1 1" preserveAspectRatio="none" class="h-full w-full">
				<line
					x1="0.05"
					y1="0.5"
					x2="0.95"
					y2="0.5"
					stroke="rgba(255, 255, 255, 0.3)"
					stroke-width="0.003"
				/>

				{#each chartData.positions || [] as value, i}
					<circle cx={value} cy="0.5" r="0.008" fill="rgba(255, 255, 255, 0.8)" />
				{/each}

				{#if chartData.average !== undefined && chartData.average !== null}
					<circle cx={chartData.average} cy="0.5" r="0.02" fill="white" class="average-point" />

					{#if chartData.stdDev !== undefined}
						<rect
							x={Math.max(0, chartData.average - chartData.stdDev * 1.5)}
							y="0.45"
							width={Math.min(
								1 - Math.max(0, chartData.average - chartData.stdDev * 1.5),
								chartData.stdDev * 3
							)}
							height="0.1"
							fill="rgba(255, 255, 255, 0.1)"
						/>
					{/if}
				{/if}

				{#if userHasVoted && chartData.poll.user_vote !== null && chartData.poll.user_vote !== undefined}
					<circle cx={chartData.poll.user_vote} cy="0.5" r="0.015" fill="rgb(249, 115, 22)" />
				{/if}

				<text
					x="0.05"
					y="0.4"
					fill="white"
					font-size="0.04"
					text-anchor="middle"
					font-family="system-ui, -apple-system, sans-serif"
					font-weight="400"
				>
					{chartData.poll.options[0]}
				</text>
				<text
					x="0.95"
					y="0.4"
					fill="white"
					font-size="0.04"
					text-anchor="middle"
					font-family="system-ui, -apple-system, sans-serif"
					font-weight="400"
				>
					{chartData.poll.options[1]}
				</text>
			</svg>
		</div>
	</div>
{:else if chartData.poll.response_type >= 3}
	<div class="relative h-full w-full">
		<div
			class="absolute inset-0 cursor-crosshair bg-black"
			on:pointerdown={handlePointerDown}
			on:pointermove={handlePointerMove}
			on:pointerup={handlePointerUp}
		>
			<svg bind:this={svgRef} viewBox="0 0 1 1" preserveAspectRatio="none" class="h-full w-full" />

			{#if dragging2DPosition}
				<div
					class="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 transform"
					style="left: {dragging2DPosition.x * 100}%; top: {dragging2DPosition.y * 100}%;"
				>
					<div class="h-full w-full bg-orange-500 ring-2 ring-white"></div>
				</div>
			{/if}

			{#if userHasVoted2D && chartData.poll.user_vote_2d}
				<div
					class="absolute -translate-x-1/2 -translate-y-1/2 transform"
					style="left: {chartData.poll.user_vote_2d.x * 100}%; top: {chartData.poll.user_vote_2d.y *
						100}%;"
				>
					<div class="h-4 w-4 bg-orange-500 ring-2 ring-white"></div>
				</div>
			{/if}

			<div class="absolute right-4 bottom-4">
				<button
					class="bg-black/50 px-3 py-1 text-sm text-white backdrop-blur hover:bg-black/70"
					on:click={toggleHeatmap}
				>
					{heatmapEnabled ? 'Hide' : 'Show'} Votes
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showSavedMessage}
	<div
		class="absolute right-8 bottom-8 left-8 flex items-center justify-between bg-black/50 px-4
		py-2 text-center text-white backdrop-blur transition-opacity duration-300"
		transition:fade={{ duration: 200 }}
	>
		<span>Vote saved!</span>
	</div>
{/if}

<style>
	:global(.vote-point:hover) {
		filter: brightness(1.2);
	}

	:global(.average-point) {
		filter: drop-shadow(0 0 3px rgba(255, 255, 255, 0.5));
	}
</style>
