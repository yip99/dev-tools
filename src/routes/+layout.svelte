<!-- src/routes/+layout.svelte -->
<script>
	import { onMount } from 'svelte';
	import '../app.css';

	let { children } = $props();

	const THEMES = ['system', 'light', 'dark'];
	let theme = $state('system');

	onMount(() => {
		// Attribute already set by inline script in app.html — just sync state
		const applied = document.documentElement.getAttribute('data-theme');
		if (applied && THEMES.includes(applied)) {
			theme = applied;
		}
	});

	function applyTheme(t) {
		document.documentElement.setAttribute('data-theme', t);
	}

	function cycleTheme() {
		const idx = THEMES.indexOf(theme);
		const next = THEMES[(idx + 1) % THEMES.length];
		theme = next;
		localStorage.setItem('theme', next);
		applyTheme(next);
	}
</script>

<div class="site-wrapper">
	<header class="site-header">
		<div class="profile-card">
			<div class="profile-identity">
				<div class="profile-text">
					<a class="profile-name" href="/">DevTools</a>
					<span class="profile-title">Utility, Precision</span>
				</div>
			</div>

			<nav class="profile-nav" aria-label="Primary">
				<a
					class="nav-link github"
					target="_blank"
					rel="noreferrer"
					href="https://github.com/your-username/devtools"
					aria-label="GitHub"
					title="GitHub"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="18"
						height="18"
						fill="currentColor"
						viewBox="0 0 256 256"
						aria-hidden="true"
					>
						<path
							d="M206.13,75.92A57.79,57.79,0,0,0,201.2,29a6,6,0,0,0-5.2-3,57.77,57.77,0,0,0-47,24H123A57.77,57.77,0,0,0,76,26a6,6,0,0,0-5.2,3,57.79,57.79,0,0,0-4.93,46.92A55.88,55.88,0,0,0,58,104v8a54.06,54.06,0,0,0,50.45,53.87A37.85,37.85,0,0,0,98,192v10H72a26,26,0,0,1-26-26A38,38,0,0,0,8,138a6,6,0,0,0,0,12,26,26,0,0,1,26,26,38,38,0,0,0,38,38H98v18a6,6,0,0,0,12,0V192a26,26,0,0,1,52,0v40a6,6,0,0,0,12,0V192a37.85,37.85,0,0,0-10.45-26.13A54.06,54.06,0,0,0,214,112v-8A55.88,55.88,0,0,0,206.13,75.92ZM202,112a42,42,0,0,1-42,42H112a42,42,0,0,1-42-42v-8a43.86,43.86,0,0,1,7.3-23.69,6,6,0,0,0,.81-5.76,45.85,45.85,0,0,1,1.43-36.42,45.85,45.85,0,0,1,35.23,21.1A6,6,0,0,0,119.83,62h32.34a6,6,0,0,0,5.06-2.76,45.83,45.83,0,0,1,35.23-21.11,45.85,45.85,0,0,1,1.43,36.42,6,6,0,0,0,.79,5.74A43.78,43.78,0,0,1,202,104Z"
						></path>
					</svg>
				</a>
				{#if theme}
					<button
						class="theme-toggle"
						onclick={cycleTheme}
						title="Theme: {theme} (click to cycle)"
						aria-label="Toggle theme, currently {theme}"
					>
						{#if theme === 'light'}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
							>
								<circle cx="12" cy="12" r="5" />
								<line x1="12" y1="1" x2="12" y2="3" />
								<line x1="12" y1="21" x2="12" y2="23" />
								<line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
								<line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
								<line x1="1" y1="12" x2="3" y2="12" />
								<line x1="21" y1="12" x2="23" y2="12" />
								<line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
								<line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
							</svg>
						{:else if theme === 'dark'}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
							>
								<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
							</svg>
						{:else}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
							>
								<rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
								<line x1="8" y1="21" x2="16" y2="21" />
								<line x1="12" y1="17" x2="12" y2="21" />
							</svg>
						{/if}
						<span class="theme-label">{theme}</span>
					</button>
				{/if}
			</nav>
		</div>
	</header>

	<main>
		{@render children()}
	</main>

	<footer class="site-footer">
		<span>Client-side only.</span>
		<div class="footer-emoji" role="img" aria-label="tools emoji">🛠️</div>
		<a href="https://github.com/your-username/devtools" class="footer-hint">View Source</a>
	</footer>
</div>
