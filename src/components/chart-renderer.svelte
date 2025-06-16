<script lang="ts">
	export let chartData: any;
	export let onVote: (position: number, position2D?: { x: number; y: number }) => void;

	// Common chart styles and classes
	const chartClasses = "relative h-full w-full cursor-crosshair";
	const textStyle = "fill: rgba(255,255,255,0.5); font-size: 2.5px; font-weight: normal;";
	
	// Vote dot and user vote styles
	const voteDotStyle = { fill: "#05ffac", r: "2" };
	const userVoteStyle = { fill: "#ff5705", r: "3" };
	const avgStyle = { fill: "white", r: "3" };
	const stdDevStyle = { fill: "rgba(255,255,255,0.1)", opacity: "0.5" };

	function handleClick(e: MouseEvent, responseType: number) {
		const target = e.currentTarget as HTMLElement;
		if (!target) return;
		
		const rect = target.getBoundingClientRect();
		const x = (e.clientX - rect.left) / rect.width;
		const y = (e.clientY - rect.top) / rect.height;

		let position = 0.5;
		let position2D = { x, y };

		switch (responseType) {
			case 2: // Line
				position = x <= 0.08 ? 0 : x >= 0.92 ? 1 : (x - 0.08) / 0.84;
				onVote(position);
				break;
			case 3: // Triangle
				if (isPointInTriangle(x, y)) {
					const [a, b, c] = getBarycentricCoords(x, y);
					position = a >= b && a >= c ? 0.1 : b >= c ? 0.3 : 0.7;
					onVote(position, position2D);
				}
				break;
			case 4: // Square
				const clampedX = Math.max(0, Math.min(1, x));
				const clampedY = Math.max(0, Math.min(1, y));
				onVote(clampedX, { x: clampedX, y: clampedY });
				break;
			case 5: // Pentagon
				if (isPointInPentagon(x, y)) {
					onVote(Math.max(0, Math.min(1, (x + y) / 2)), position2D);
				}
				break;
		}
	}

	function isPointInTriangle(x: number, y: number): boolean {
		const [a, b, c] = getBarycentricCoords(x, y);
		return a >= 0 && b >= 0 && c >= 0;
	}

	function getBarycentricCoords(x: number, y: number): [number, number, number] {
		const v0x = 0.5, v0y = 0.02;
		const v1x = 0.02, v1y = 0.95; 
		const v2x = 0.98, v2y = 0.95; 
		
		const denom = (v1y - v2y) * (v0x - v2x) + (v2x - v1x) * (v0y - v2y);
		const a = ((v1y - v2y) * (x - v2x) + (v2x - v1x) * (y - v2y)) / denom;
		const b = ((v2y - v0y) * (x - v2x) + (v0x - v2x) * (y - v2y)) / denom;
		const c = 1 - a - b;
		
		return [a, b, c];
	}

	function isPointInPentagon(x: number, y: number): boolean {
		const vertices = [
			{ x: 0.5, y: 0.02 }, { x: 0.95, y: 0.3 }, { x: 0.8, y: 0.9 }, 
			{ x: 0.2, y: 0.9 }, { x: 0.05, y: 0.3 }
		];
		
		let inside = false;
		for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
			if (vertices[i].y > y !== vertices[j].y > y &&
				x < ((vertices[j].x - vertices[i].x) * (y - vertices[i].y)) / (vertices[j].y - vertices[i].y) + vertices[i].x) {
				inside = !inside;
			}
		}
		return inside;
	}

	function renderGradients(responseType: number, colors: string[]) {
		if (!chartData.poll.gradients?.enabled) return '';
		
		const gradientConfigs: Record<number, Array<{cx: string, cy: string}>> = {
			3: [{ cx: "50%", cy: "2%" }, { cx: "2%", cy: "95%" }, { cx: "98%", cy: "95%" }],
			4: [{ cx: "50%", cy: "0%" }, { cx: "0%", cy: "0%" }, { cx: "100%", cy: "0%" }, { cx: "50%", cy: "100%" }],
			5: [{ cx: "50%", cy: "2%" }, { cx: "95%", cy: "30%" }, { cx: "80%", cy: "90%" }, { cx: "20%", cy: "90%" }, { cx: "5%", cy: "30%" }]
		};
		
		return gradientConfigs[responseType] || [];
	}
</script>

{#if chartData.poll.response_type === 2}
	<!-- Line Chart -->
	<div class={chartClasses} on:click={(e) => handleClick(e, 2)} role="button" tabindex="0">
		<div class="absolute top-1/2 right-8 left-8 h-32 -translate-y-1/2 transform rounded bg-white/10">
			{#if chartData.poll.gradients?.enabled}
				<div class="h-full w-full rounded" style="background: linear-gradient(to right, {chartData.poll.gradients.colors[0]}, {chartData.poll.gradients.colors[1]});"></div>
			{/if}
		</div>
		
		<!-- Grid lines -->
		{#each Array(5) as _, i}
			<div class="absolute top-1/2 h-32 w-px -translate-y-1/2 transform bg-white/20" style="left: {8 + ((i + 1) * 84) / 6}%"></div>
		{/each}

		<!-- Std dev area, average line, votes -->
		<div class="absolute top-1/2 h-32 -translate-y-1/2 transform rounded bg-white/10" 
			 style="left: {8 + chartData.lowerBound * 84}%; width: {(chartData.upperBound - chartData.lowerBound) * 84}%"></div>
		<div class="absolute top-1/2 h-32 w-1 -translate-x-1/2 -translate-y-1/2 transform bg-white" 
			 style="left: {8 + chartData.average * 84}%"></div>

		{#each chartData.positions as position}
			<div class="absolute top-1/2 h-24 w-2 -translate-x-1/2 -translate-y-1/2 transform rounded bg-[#05ffac]" 
				 style="left: {8 + position * 84}%"></div>
		{/each}

		{#if chartData.poll.user_vote !== null}
			<div class="absolute top-1/2 h-24 w-3 -translate-x-1/2 -translate-y-1/2 transform rounded bg-[#ff5705]" 
				 style="left: {8 + chartData.poll.user_vote * 84}%"></div>
		{/if}

		<div class="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 transform rounded-full bg-white" 
			 style="left: {8 + chartData.average * 84}%"></div>

		<!-- Labels -->
		<div class="absolute top-8 left-8 text-sm font-normal text-white/50">{chartData.poll.options[0]}</div>
		<div class="absolute top-8 right-8 text-right text-sm font-normal text-white/50">{chartData.poll.options[1]}</div>
	</div>

{:else if [3, 4, 5].includes(chartData.poll.response_type)}
	<!-- Polygon Charts -->
	<div class={chartClasses} on:click={(e) => handleClick(e, chartData.poll.response_type)} role="button" tabindex="0">
		<svg viewBox="0 0 100 100" class="h-full w-full">
			{#if chartData.poll.gradients?.enabled}
				<defs>
					{#each renderGradients(chartData.poll.response_type, chartData.poll.gradients.colors) as config, i}
						<radialGradient id="corner{i+1}" cx={config.cx} cy={config.cy} r="80%">
							<stop offset="0%" style="stop-color:{chartData.poll.gradients.colors[i]};stop-opacity:0.6" />
							<stop offset="70%" style="stop-color:{chartData.poll.gradients.colors[i]};stop-opacity:0.1" />
							<stop offset="100%" style="stop-color:transparent;stop-opacity:0" />
						</radialGradient>
					{/each}
				</defs>
			{/if}

			<!-- Base shape -->
			{#if chartData.poll.response_type === 3}
				<polygon points="50,2 2,95 98,95" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.3)" stroke-width="0.5" />
				{#if chartData.poll.gradients?.enabled}
					{#each renderGradients(3, chartData.poll.gradients.colors) as _, i}
						<polygon points="50,2 2,95 98,95" fill="url(#corner{i+1})" />
					{/each}
				{/if}
			{:else if chartData.poll.response_type === 4}
				<rect x="0" y="0" width="100" height="100" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.3)" stroke-width="0.5" />
				{#if chartData.poll.gradients?.enabled}
					{#each renderGradients(4, chartData.poll.gradients.colors) as _, i}
						<rect x="0" y="0" width="100" height="100" fill="url(#corner{i+1})" />
					{/each}
				{/if}
			{:else if chartData.poll.response_type === 5}
				<polygon points="50,2 95,30 80,90 20,90 5,30" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.3)" stroke-width="0.5" />
				{#if chartData.poll.gradients?.enabled}
					{#each renderGradients(5, chartData.poll.gradients.colors) as _, i}
						<polygon points="50,2 95,30 80,90 20,90 5,30" fill="url(#corner{i+1})" />
					{/each}
				{/if}
			{/if}

			<!-- Vote dots -->
			{#if chartData.positions2D?.length > 0}
				{#each chartData.positions2D as pos}
					<circle cx={pos.x * 100} cy={pos.y * 100} {...voteDotStyle} />
				{/each}
			{:else}
				{#each chartData.positions as position}
					<circle cx={50 + (position - 0.5) * 60} cy={50} {...voteDotStyle} />
				{/each}
			{/if}

			<!-- User vote -->
			{#if chartData.poll.user_vote !== null}
				{#if chartData.poll.user_vote_2d}
					<circle cx={chartData.poll.user_vote_2d.x * 100} cy={chartData.poll.user_vote_2d.y * 100} {...userVoteStyle} />
				{:else}
					<circle cx={50 + (chartData.poll.user_vote - 0.5) * 60} cy={50} {...userVoteStyle} />
				{/if}
			{/if}

			<!-- Average indicator -->
			{#if chartData.average2D?.length === 2}
				<circle cx={chartData.average2D[0] * 100} cy={chartData.average2D[1] * 100} r={chartData.stdDev * 60 * 1.5} {...stdDevStyle} />
				<circle cx={chartData.average2D[0] * 100} cy={chartData.average2D[1] * 100} {...avgStyle} />
			{:else}
				<circle cx={50 + (chartData.average - 0.5) * 60} cy={50} r={chartData.stdDev * 60 * 1.5} {...stdDevStyle} />
				<circle cx={50 + (chartData.average - 0.5) * 60} cy={50} {...avgStyle} />
			{/if}

			<!-- Labels -->
			{#if chartData.poll.response_type === 3}
				<text x="50" y="8" text-anchor="middle" style={textStyle}>{chartData.poll.options[0]}</text>
				<text x="8" y="90" text-anchor="start" style={textStyle}>{chartData.poll.options[1]}</text>
				<text x="92" y="90" text-anchor="end" style={textStyle}>{chartData.poll.options[2]}</text>
			{:else if chartData.poll.response_type === 4}
				<text x="8" y="8" text-anchor="start" style={textStyle}>{chartData.poll.options[0]}</text>
				<text x="92" y="8" text-anchor="end" style={textStyle}>{chartData.poll.options[1]}</text>
				<text x="92" y="95" text-anchor="end" style={textStyle}>{chartData.poll.options[2]}</text>
				<text x="8" y="95" text-anchor="start" style={textStyle}>{chartData.poll.options[3]}</text>
			{:else if chartData.poll.response_type === 5}
				<text x="50" y="8" text-anchor="middle" style={textStyle}>{chartData.poll.options[0]}</text>
				<text x="92" y="25" text-anchor="end" style={textStyle}>{chartData.poll.options[1]}</text>
				<text x="75" y="95" text-anchor="middle" style={textStyle}>{chartData.poll.options[2]}</text>
				<text x="25" y="95" text-anchor="middle" style={textStyle}>{chartData.poll.options[3]}</text>
				<text x="8" y="25" text-anchor="start" style={textStyle}>{chartData.poll.options[4]}</text>
			{/if}
		</svg>
	</div>
{/if}
