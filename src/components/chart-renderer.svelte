<script context="module" lang="ts">
	export type ChartData = {
		poll: {
			id?: string;
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
	import { fade } from 'svelte/transition';
	export let chartData: ChartData;
	export let onVote: (position: number, position2D?: { x: number; y: number }) => void;

	// Shape geometry derived directly from response_type (2 line, 3 triangle, 4 square, 5 pentagon)
	function computeShapePoints(rt: number | undefined) {
		if (rt === 2) {
			return [
				{ x: 0.05, y: 0.5 },
				{ x: 0.95, y: 0.5 }
			];
		} else if (rt === 3) {
			return [
				{ x: 0.5, y: 0.1 },
				{ x: 0.1, y: 0.9 },
				{ x: 0.9, y: 0.9 }
			];
		} else if (rt === 4) {
			return [
				{ x: 0.1, y: 0.1 },
				{ x: 0.9, y: 0.1 },
				{ x: 0.9, y: 0.9 },
				{ x: 0.1, y: 0.9 }
			];
		} else if (rt === 5) {
			const cx = 0.5,
				cy = 0.5,
				r = 0.45;
			return Array.from({ length: 5 }, (_, i) => {
				const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
				return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
			});
		}
		return [];
	}

	let shapePoints: Array<{ x: number; y: number }> = [];
	$: shapePoints = computeShapePoints(chartData?.poll?.response_type);
	let edgeMidpoints: Array<{ x: number; y: number }> = [];
	$: edgeMidpoints = shapePoints.length
		? shapePoints.map((p, i) => {
				const n = shapePoints[(i + 1) % shapePoints.length];
				return { x: (p.x + n.x) / 2, y: (p.y + n.y) / 2 };
			})
		: [];

	// Gradients originate from edge midpoints rather than corners
	const renderGradients = () =>
		edgeMidpoints.map((m) => ({ cx: `${m.x * 100}%`, cy: `${m.y * 100}%` }));

	// interaction state
	let svgRef: SVGSVGElement;
	let heatmapEnabled = true;
	let isDragging = false;
	let dragging2DPosition: { x: number; y: number } | null = null;
	let lastPosition: number | null = null; // 1D
	let lastPosition2D: { x: number; y: number } | null = null; // 2D
	let userHasVoted = !!chartData?.poll?.user_vote;
	let userHasVoted2D = !!chartData?.poll?.user_vote_2d;
	let showSavedMessage = false;
	// unique id for SVG gradient/clip path scoping, force update on poll or response type change
	let instanceId = Math.random().toString(36).slice(2, 9);
	let prevPollId: string | undefined;
	let prevResponseType: number | undefined;
	$: {
		const currentId = chartData?.poll?.id != null ? String(chartData.poll.id) : '';
		const rt = chartData?.poll?.response_type;
		if (currentId !== prevPollId || rt !== prevResponseType) {
			instanceId = Math.random().toString(36).slice(2, 9);
			lastPosition = null;
			lastPosition2D = null;
			dragging2DPosition = null;
			isDragging = false;
			userHasVoted = !!chartData?.poll?.user_vote;
			userHasVoted2D = !!chartData?.poll?.user_vote_2d;
			prevPollId = currentId;
			prevResponseType = rt;
		}
	}

	// buckets for 1D line distribution (for rectangle scale)
	let lineBuckets: Array<{ x: number; count: number }> = [];
	$: if (chartData.poll.response_type === 2 && Array.isArray(chartData.positions)) {
		// bucket into 80 bins across 0..1
		const bins = Array.from({ length: 80 }, (_, i) => ({ x: i / 79, count: 0 }));
		chartData.positions.forEach((p) => {
			if (typeof p === 'number') {
				const idx = Math.min(79, Math.max(0, Math.round(p * 79)));
				bins[idx].count++;
			}
		});
		const max = Math.max(1, ...bins.map((b) => b.count));
		lineBuckets = bins.filter((b) => b.count > 0).map((b) => ({ x: b.x, count: b.count / max }));
	}

	const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
	const snap = (p: { x: number; y: number }) => ({ x: clamp01(p.x), y: clamp01(p.y) });

	// ---- Fallback / derived statistics (mean & std dev) ----
	function computeMean(values: number[]) {
		if (!values.length) return 0.5;
		return values.reduce((a, b) => a + b, 0) / values.length;
	}
	function computeStd(values: number[], mean: number) {
		if (values.length < 2) return 0;
		const variance = values.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (values.length - 1);
		return Math.sqrt(variance);
	}
	// 1D stats fallback
	let derivedAverage1D: number | null = null;
	let derivedStd1D: number | null = null;
	$: if (chartData.poll.response_type === 2) {
		const raw = (chartData.positions || []).filter((v) => typeof v === 'number');
		const avg = chartData.average ?? computeMean(raw);
		const std = chartData.stdDev ?? computeStd(raw, avg);
		derivedAverage1D = avg;
		derivedStd1D = std;
	} else {
		derivedAverage1D = null;
		derivedStd1D = null;
	}
	// 1D display helpers (fallback min std dev so band is visible)
	let sdBandStart1D = 0,
		sdBandEnd1D = 0;
	$: if (derivedAverage1D != null) {
		const s = (derivedStd1D && derivedStd1D > 0 ? derivedStd1D : 0.03) * 1.5; // 1.5 * std dev band (min width fallback)
		sdBandStart1D = clamp01(derivedAverage1D - s);
		sdBandEnd1D = clamp01(derivedAverage1D + s);
	}

	// 2D radial std dev fallback: distance to mean point
	let derivedRadialStd2D: number | null = null;
	let avg2D: [number, number] | null = null;
	$: if (chartData.poll.response_type >= 3) {
		if (
			chartData.average2D &&
			chartData.average2D.length === 2 &&
			chartData.average2D.every((v) => typeof v === 'number')
		) {
			avg2D = [chartData.average2D[0], chartData.average2D[1]];
		} else if (chartData.positions2D && chartData.positions2D.length) {
			const sx = chartData.positions2D.reduce((a, p) => a + p.x, 0);
			const sy = chartData.positions2D.reduce((a, p) => a + p.y, 0);
			avg2D = [sx / chartData.positions2D.length, sy / chartData.positions2D.length];
		} else {
			avg2D = [0.5, 0.5];
		}
		// std dev
		if (chartData.stdDev) {
			derivedRadialStd2D = chartData.stdDev;
		} else if (chartData.positions2D && chartData.positions2D.length > 1) {
			const cx = avg2D[0];
			const cy = avg2D[1];
			const dists = chartData.positions2D.map((p) => Math.hypot(p.x - cx, p.y - cy));
			const meanD = computeMean(dists);
			derivedRadialStd2D = computeStd(dists, meanD) || 0.0001;
		} else {
			derivedRadialStd2D = 0.0001;
		}
	} else {
		avg2D = null;
		derivedRadialStd2D = null;
	}
	let std2DOuterRadius = 0,
		std2DInnerRadius = 0;
	$: if (avg2D) {
		const base = derivedRadialStd2D && derivedRadialStd2D > 0.0002 ? derivedRadialStd2D : 0.06;
		std2DInnerRadius = Math.min(0.45, base);
		std2DOuterRadius = Math.min(0.45, base * 1.5);
	}

	// 1D vote (line)
	function handleVote(e: MouseEvent) {
		if (chartData.poll.response_type !== 2) return;
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const rel = (e.clientX - rect.left) / rect.width;
		lastPosition = clamp01((rel - 0.05) / 0.9);
		submitVote();
		userHasVoted = true;
	}

	// helper for pointer events in 2D area
	function relFromEvent(e: PointerEvent, el: HTMLElement) {
		const r = el.getBoundingClientRect();
		return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
	}
	function handlePointerDown(e: PointerEvent) {
		if (chartData.poll.response_type < 3) return;
		// Restrict voting to within the polygon shape
		const rel = snap(relFromEvent(e, e.currentTarget as HTMLElement));
		if (shapePoints.length >= 3) {
			let inside = false;
			for (let i = 0, j = shapePoints.length - 1; i < shapePoints.length; j = i++) {
				const xi = shapePoints[i].x,
					yi = shapePoints[i].y;
				const xj = shapePoints[j].x,
					yj = shapePoints[j].y;
				const intersect =
					yi > rel.y !== yj > rel.y && rel.x < ((xj - xi) * (rel.y - yi)) / (yj - yi + 1e-9) + xi;
				if (intersect) inside = !inside;
			}
			if (!inside) {
				return;
			}
		}
		isDragging = true;
		lastPosition2D = rel;
		dragging2DPosition = lastPosition2D;
	}
	function handlePointerMove(e: PointerEvent) {
		if (!isDragging || chartData.poll.response_type < 3) return;
		const rel = snap(relFromEvent(e, e.currentTarget as HTMLElement));
		if (shapePoints.length >= 3) {
			let inside = false;
			for (let i = 0, j = shapePoints.length - 1; i < shapePoints.length; j = i++) {
				const xi = shapePoints[i].x,
					yi = shapePoints[i].y;
				const xj = shapePoints[j].x,
					yj = shapePoints[j].y;
				const intersect =
					yi > rel.y !== yj > rel.y && rel.x < ((xj - xi) * (rel.y - yi)) / (yj - yi + 1e-9) + xi;
				if (intersect) inside = !inside;
			}
			if (!inside) return;
		}
		lastPosition2D = rel;
		dragging2DPosition = lastPosition2D;
	}
	function handlePointerUp(e: PointerEvent) {
		if (!isDragging || chartData.poll.response_type < 3) return;
		isDragging = false;
		const rel = snap(relFromEvent(e, e.currentTarget as HTMLElement));
		if (shapePoints.length >= 3) {
			let inside = false;
			for (let i = 0, j = shapePoints.length - 1; i < shapePoints.length; j = i++) {
				const xi = shapePoints[i].x,
					yi = shapePoints[i].y;
				const xj = shapePoints[j].x,
					yj = shapePoints[j].y;
				const intersect =
					yi > rel.y !== yj > rel.y && rel.x < ((xj - xi) * (rel.y - yi)) / (yj - yi + 1e-9) + xi;
				if (intersect) inside = !inside;
			}
			if (!inside) {
				dragging2DPosition = null;
				return;
			}
		}
		lastPosition2D = rel;
		dragging2DPosition = null;
		submitVote();
		userHasVoted2D = true;
	}

	function submitVote() {
		if (chartData.poll.response_type >= 3) {
			if (lastPosition2D) {
				// For polygon shapes derive scalar via distance to edges (using current shapePoints)
				const pts = shapePoints;
				const px = lastPosition2D.x,
					py = lastPosition2D.y;
				// Compute distances to each edge (line segment) and invert (closer edge -> higher weight)
				function distToSeg(ax: number, ay: number, bx: number, by: number) {
					const vx = bx - ax,
						vy = by - ay;
					const wx = px - ax,
						wy = py - ay;
					const c1 = vx * wx + vy * wy;
					if (c1 <= 0) return Math.hypot(px - ax, py - ay);
					const c2 = vx * vx + vy * vy;
					if (c2 <= c1) return Math.hypot(px - bx, py - by);
					const t = c1 / c2;
					const projx = ax + t * vx,
						projy = ay + t * vy;
					return Math.hypot(px - projx, py - projy);
				}
				const edgeDists = pts.map((p, i) => {
					const n = pts[(i + 1) % pts.length];
					return distToSeg(p.x, p.y, n.x, n.y);
				});
				const maxD = Math.max(...edgeDists, 0.0001);
				const inv = edgeDists.map((d) => 1 - d / maxD);
				const sum = inv.reduce((a, b) => a + b, 0) || 1;
				let scalar = 0;
				inv.forEach((w, i) => {
					scalar += (w / sum) * (i / (inv.length - 1 || 1));
				});
				scalar = clamp01(scalar);
				onVote(scalar, lastPosition2D);
			}
			lastPosition2D = null;
		} else if (lastPosition !== null) {
			onVote(lastPosition);
			lastPosition = null;
		}
		showSavedMessage = true;
		setTimeout(() => (showSavedMessage = false), 1100);
	}

	// Declarative data for 2D heatmap & polygon
	let pathD = '';
	$: if (chartData.poll.response_type >= 3) {
		pathD = shapePoints.length
			? shapePoints.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ') + ' Z'
			: '';
	} else {
		pathD = '';
	}
	// cluster positions for heatmap
	let clusters: Array<{ x: number; y: number; count: number }> = [];
	$: if (chartData.poll.response_type >= 3 && heatmapEnabled && chartData.positions2D?.length) {
		const maxRefDist = 0.07;
		const raw: Array<{ x: number; y: number; count: number }> = [];
		chartData.positions2D.forEach((p) => {
			const f = raw.find(
				(c) => Math.abs(c.x - p.x) < maxRefDist && Math.abs(c.y - p.y) < maxRefDist
			);
			if (f) {
				f.count++;
				f.x = (f.x * (f.count - 1) + p.x) / f.count;
				f.y = (f.y * (f.count - 1) + p.y) / f.count;
			} else raw.push({ x: p.x, y: p.y, count: 1 });
		});
		clusters = raw;
	} else clusters = [];

	// proximity opacity for line options
	$: currentLinePosition = lastPosition ?? chartData.poll.user_vote ?? chartData.average ?? 0.5;
	$: leftLabelOpacity =
		chartData.poll.response_type === 2 ? 0.4 + 0.6 * (1 - currentLinePosition) : 1;
	$: rightLabelOpacity = chartData.poll.response_type === 2 ? 0.4 + 0.6 * currentLinePosition : 1;

	// Map poll options to positions for polygon labels
	let labelPositions: Array<{ x: number; y: number }> = [];
	$: if (chartData.poll.response_type >= 3) {
		const base = edgeMidpoints.length ? edgeMidpoints : shapePoints;
		if (base.length) {
			labelPositions = chartData.poll.options.map((_, i) => base[i % base.length]);
		} else labelPositions = [];
	} else labelPositions = [];
</script>

<div class="relative w-full">
	<div class="relative w-full">
		{#key `${instanceId}-${chartData.poll.id ?? ''}-${chartData.poll.response_type}-${shapePoints.map((p) => p.x.toFixed(3) + p.y.toFixed(3)).join('-')}`}
			<div class="relative w-full">
				{#if chartData.poll.response_type === 2}
					<!-- 1D RECTANGLE SCALE -->
					<div class="relative h-48 select-none">
						<div
							class="absolute inset-0"
							role="slider"
							tabindex="0"
							aria-label="Vote position"
							aria-valuemin="0"
							aria-valuemax="1"
							aria-valuenow={lastPosition ?? chartData.poll.user_vote ?? chartData.average}
							on:click={handleVote}
							on:keydown={(e) => {
								if (e.key === 'ArrowLeft') {
									e.preventDefault();
									lastPosition = clamp01((lastPosition ?? chartData.poll.user_vote ?? 0.5) - 0.05);
									submitVote();
								} else if (e.key === 'ArrowRight') {
									e.preventDefault();
									lastPosition = clamp01((lastPosition ?? chartData.poll.user_vote ?? 0.5) + 0.05);
									submitVote();
								} else if (e.key === 'Home') {
									e.preventDefault();
									lastPosition = 0;
									submitVote();
								} else if (e.key === 'End') {
									e.preventDefault();
									lastPosition = 1;
									submitVote();
								} else if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									lastPosition = lastPosition ?? chartData.poll.user_vote ?? 0.5;
									submitVote();
								}
							}}
						>
							<div
								class="absolute inset-x-4 top-6 bottom-6 overflow-hidden rounded-md border border-white/15 bg-black/20 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.12),transparent_70%)]"
							>
								<!-- background gradient left->right accent soft -->
								<div
									class="absolute inset-0 bg-gradient-to-r from-[rgb(var(--primary))]/30 via-[rgb(var(--primary))]/10 to-[rgb(var(--primary))]/30 opacity-60"
								></div>
								{#if derivedAverage1D != null}
									<!-- 1D Std Dev band (±1.5σ) -->
									<div
										class="sd-band-1d absolute top-0 bottom-0"
										style="left:{(sdBandStart1D * 0.9 + 0.05) * 100}%; width:{Math.max(
											0.8,
											(sdBandEnd1D - sdBandStart1D) * 0.9 * 100
										)}%;"
									></div>
								{/if}
								<!-- vote distribution lines -->
								{#if lineBuckets.length}
									{#each lineBuckets as b}
										<div
											class="absolute top-0 bottom-0 -translate-x-1/2"
											style="left:{(b.x * 0.9 + 0.05) * 100}%"
										>
											<div
												class="h-full w-px"
												style="background:linear-gradient(to bottom,rgba(255,255,255,0),rgba(255,255,255,{b.count *
													0.35}),rgba(255,255,255,0));"
											></div>
										</div>
									{/each}
								{/if}
								<!-- vertical grid lines -->
								{#each [0.25, 0.5, 0.75] as g}
									<div
										class="absolute top-0 bottom-0 w-px bg-white/10"
										style="left:{g * 100}%"
									></div>
								{/each}
								<!-- option labels left/right centered vertically -->
								<div
									class="absolute top-1/2 left-2 max-w-[30%] -translate-y-1/2 text-base leading-tight font-medium text-white"
									style="font-family: 'Mozilla Text', system-ui, sans-serif; opacity:{leftLabelOpacity}"
								>
									{chartData.poll.options && chartData.poll.options[0]
										? chartData.poll.options[0]
										: 'Option 1'}
								</div>
								<div
									class="absolute top-1/2 right-2 max-w-[30%] -translate-y-1/2 text-right text-base leading-tight font-medium text-white"
									style="font-family: 'Mozilla Text', system-ui, sans-serif; opacity:{rightLabelOpacity}"
								>
									{chartData.poll.options && chartData.poll.options[1]
										? chartData.poll.options[1]
										: 'Option 2'}
								</div>
								<!-- average marker -->
								{#if derivedAverage1D != null}
									<div
										class="absolute top-0 bottom-0 w-[3px] -translate-x-1/2 bg-white/80 shadow-[0_0_4px_rgba(255,255,255,0.6)]"
										style="left:{(derivedAverage1D * 0.9 + 0.05) * 100}%"
										title="Average"
									></div>
								{/if}
								{#if derivedAverage1D != null}
									<div
										class="absolute -top-5 -translate-x-1/2 text-[10px] font-medium tracking-wide text-white"
										style="left:{(derivedAverage1D * 0.9 + 0.05) *
											100}%; font-family: 'Mozilla Text', system-ui, sans-serif;"
									>
										Avg {(derivedAverage1D * 100).toFixed(1)}%
										{#if derivedStd1D != null && derivedStd1D > 0}
											<span class="ml-1 opacity-70">±{(derivedStd1D * 100).toFixed(1)}%</span>
										{/if}
									</div>
								{/if}
								<!-- user vote marker -->
								{#if chartData.poll.user_vote != null}
									<div
										class="absolute top-0 bottom-0 w-[5px] -translate-x-1/2 bg-[rgb(var(--primary))] shadow-[0_0_6px_rgba(var(--primary),0.8)]"
										style="left:{(chartData.poll.user_vote * 0.9 + 0.05) * 100}%"
									></div>
								{/if}
								<!-- in-progress marker -->
								{#if lastPosition != null}
									<div
										class="absolute top-0 bottom-0 w-[5px] -translate-x-1/2 bg-white/80 mix-blend-screen"
										style="left:{(lastPosition * 0.9 + 0.05) * 100}%"
									></div>
								{/if}
							</div>
						</div>
					</div>
				{:else if chartData.poll.response_type >= 3}
					<!-- 2D SHAPE AREA CENTERED -->
					<div
						class="relative flex w-full items-center justify-center select-none"
						style="aspect-ratio:1/1;"
					>
						<div
							class="relative h-full w-full"
							on:pointerdown={handlePointerDown}
							on:pointermove={handlePointerMove}
							on:pointerup={handlePointerUp}
							on:pointerleave={handlePointerUp}
						>
							<svg bind:this={svgRef} viewBox="0 0 1 1" class="relative z-0 h-full w-full">
								{#if pathD}
									<defs>
										<clipPath id="clip-{instanceId}">
											<path d={pathD} />
										</clipPath>
										{#if chartData.poll.gradients?.enabled && chartData.poll.gradients.colors && edgeMidpoints.length === chartData.poll.gradients.colors.length}
											{#each edgeMidpoints as m, i}
												<radialGradient
													id="edge-grad-{instanceId}-{i}"
													cx={m.x * 100 + '%'}
													cy={m.y * 100 + '%'}
													r="65%"
												>
													<stop
														offset="0%"
														stop-color={chartData.poll.gradients.colors[i]}
														stop-opacity="0.55"
													/>
													<stop
														offset="70%"
														stop-color={chartData.poll.gradients.colors[i]}
														stop-opacity="0.12"
													/>
													<stop offset="100%" stop-color="transparent" stop-opacity="0" />
												</radialGradient>
											{/each}
										{/if}
									</defs>
									{#if chartData.poll.gradients?.enabled && chartData.poll.gradients.colors && edgeMidpoints.length === chartData.poll.gradients.colors.length}
										{#each edgeMidpoints as m, i}
											<circle
												cx={m.x}
												cy={m.y}
												r="0.65"
												fill={`url(#edge-grad-${instanceId}-${i})`}
												clip-path={`url(#clip-${instanceId})`}
											/>
										{/each}
									{/if}
									<path
										d={pathD}
										fill="none"
										stroke="rgba(255,255,255,0.35)"
										stroke-width="0.003"
									/>
									{#if clusters.length}
										{#each clusters as c}
											<circle
												class="vote-cloud"
												cx={c.x}
												cy={c.y}
												r={0.02 + (c.count / Math.max(1, clusters.length / 2)) * 0.05}
												fill={`rgba(255,255,255,${Math.min(0.5, 0.15 + (c.count / Math.max(1, clusters.length / 2)) * 0.35)})`}
											/>
										{/each}
									{/if}
									{#if avg2D && avg2D[0] >= 0 && avg2D[0] <= 1 && avg2D[1] >= 0 && avg2D[1] <= 1}
										<g class="avg-layer">
											<!-- 1.5σ ring -->
											<circle
												class="avg-std-ring"
												cx={avg2D[0]}
												cy={avg2D[1]}
												r={std2DOuterRadius || 0.0001}
												fill="none"
												stroke="rgba(255,255,255,0.35)"
												stroke-width="0.003"
												stroke-dasharray="0.01,0.01"
											/>
											<circle
												class="avg-core"
												cx={avg2D[0]}
												cy={avg2D[1]}
												r="0.022"
												fill="rgba(255,255,255,0.95)"
											/>
										</g>
									{/if}
								{/if}
							</svg>
							<!-- Edge midpoint labels -->
							{#if chartData.poll.options.length === edgeMidpoints.length && edgeMidpoints.length > 2}
								{#each edgeMidpoints as m, i (i)}
									<div
										class="label-edge pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-[15px] font-medium tracking-wide text-white/85 md:text-base"
										style="left:{m.x * 100}%; top:{m.y *
											100}%; font-family: 'Mozilla Text', system-ui, sans-serif;"
									>
										{chartData.poll.options[i]}
									</div>
								{/each}
							{/if}
							{#if dragging2DPosition}
								<div
									class="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
									style="left:{dragging2DPosition.x * 100}%; top:{dragging2DPosition.y * 100}%"
								>
									<div
										class="h-4 w-4 rounded-full bg-white ring-2 ring-[rgb(var(--primary))]"
									></div>
								</div>
							{/if}
							{#if userHasVoted2D && chartData.poll.user_vote_2d}
								<div
									class="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
									style="left:{chartData.poll.user_vote_2d.x * 100}%; top:{chartData.poll
										.user_vote_2d.y * 100}%"
								>
									<div
										class="h-4 w-4 rounded-full bg-[rgb(var(--primary))] ring-2 ring-white"
									></div>
								</div>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		{/key}
	</div>

	{#if showSavedMessage}
		<div
			class="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center"
			transition:fade={{ duration: 150 }}
		>
			<div
				class="rounded-md bg-black/70 px-3 py-1 text-[10px] tracking-wide text-white/90 uppercase backdrop-blur"
			>
				Vote saved
			</div>
		</div>
	{/if}
</div>

<style>
	:global(.average-point) {
		filter: drop-shadow(0 0 3px rgba(255, 255, 255, 0.5));
	}
	:global(.vote-cloud) {
		filter: blur(2px);
	}
	:global(.avg-core),
	:global(.avg-std-area),
	:global(.avg-std-ring) {
		pointer-events: none;
	}
	:global(.avg-core) {
		filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.6));
	}
	:global(g.avg-layer) {
		pointer-events: none;
	}
	.sd-band-1d {
		background: rgba(255, 255, 255, 0.18);
		box-shadow:
			0 0 6px rgba(255, 255, 255, 0.4) inset,
			0 0 4px rgba(255, 255, 255, 0.4);
		mix-blend-mode: screen;
	}
	.label-edge {
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
		max-width: 7rem;
		text-align: center;
		font-family: 'Mozilla Text', system-ui, sans-serif;
	}
</style>
