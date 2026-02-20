<!-- src/routes/+page.svelte -->
<main>
	<article class="post">
		<header class="post-header">
			<h1>Developer Utilities</h1>
			<span class="post-date"
				>Instruments for the <span class="accent-gold">local environment</span>.</span
			>
		</header>

		<p>
			A collection of stateless, client-side tools. No data leaves your browser. Because pasting
			your JWTs into random websites is a <span class="tooltip">bad idea</span>.
		</p>

		<!-- Tools Grid -->
		<div class="tools-grid">
			<!-- UNIX Time -->
			<a href="/epoch" class="tool-card">
				<div class="tool-header">
					<span class="tool-icon">1970</span>
					<span class="tool-arrow">→</span>
				</div>
				<h3>Epoch Converter</h3>
				<p>Human-readable timestamps from integer seconds. Time is an illusion.</p>
			</a>

			<!-- JSON Formatter -->
			<a href="/json" class="tool-card">
				<div class="tool-header">
					<span class="tool-icon accent-gold">{'{ }'}</span>
					<span class="tool-arrow">→</span>
				</div>
				<h3>JSON Formatter</h3>
				<p>Validate, prettify, and minify JSON. Handling whitespace so you don't have to.</p>
			</a>

			<!-- Text Diff -->
			<a href="/diff" class="tool-card">
				<div class="tool-header">
					<span class="tool-icon accent-red">!=</span>
					<span class="tool-arrow">→</span>
				</div>
				<h3>Text Comparison</h3>
				<p>
					Find the difference. Semantic <span class="accent-red">deletions</span> and
					<span class="accent-green">additions</span> highlighted.
				</p>
			</a>

			<!-- UUID Generator -->
			<a href="/uuid" class="tool-card">
				<div class="tool-header">
					<span class="tool-icon accent-purple">id</span>
					<span class="tool-arrow">→</span>
				</div>
				<h3>UUID Generator</h3>
				<p>Generate v4 UUIDs. Cryptographically secure entropy for your database keys.</p>
			</a>

			<!-- Password Generator -->
			<a href="/password" class="tool-card">
				<div class="tool-header">
					<span class="tool-icon accent-blue">***</span>
					<span class="tool-arrow">→</span>
				</div>
				<h3>Password Gen</h3>
				<p>High entropy strings. Adjustable length and character sets. Don't use "password123".</p>
			</a>

			<!-- Regex Builder -->
			<a href="/regex" class="tool-card">
				<div class="tool-header">
					<span class="tool-icon accent-green">/.*/</span>
					<span class="tool-arrow">→</span>
				</div>
				<h3>Regex Builder</h3>
				<p>Test patterns against strings. Live matches and capture groups highlighted.</p>
			</a>

			<!-- Base64 -->
			<!-- <a href="/base64" class="tool-card">
				<div class="tool-header">
					<span class="tool-icon">64</span>
					<span class="tool-arrow">→</span>
				</div>
				<h3>Base64 Encode</h3>
				<p>Convert text to Base64 and back. Useful for basic auth headers and data URIs.</p>
			</a> -->
		</div>

		<div class="calibrating-box" style="margin-top: 3rem;">More modules compiling...</div>
	</article>
</main>

<style>
	.post-header {
		margin-bottom: 2rem;
	}
	.post-date {
		font-size: 0.9rem;
		color: var(--gray);
	}

	/* --- Tools Grid Layout --- */
	.tools-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-top: 2rem;
	}

	@media (max-width: 600px) {
		.tools-grid {
			grid-template-columns: 1fr;
		}
	}

	/* --- Tool Card Styling --- */
	.tool-card {
		display: block;
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 1.5rem;
		transition: all 0.2s ease;
		text-decoration: none;
		background: transparent;
		color: var(--fg); /* Ensure text inherits correctly */
	}

	.tool-card:hover {
		border-color: var(--gray);
		transform: translateY(-2px);
		background: rgba(128, 128, 128, 0.03);
	}

	/* --- Internal Card Elements --- */
	.tool-header {
		display: flex;
		justify-content: space-between;
		margin-bottom: 1rem;
		font-size: 1.2rem;
		font-weight: bold;
	}

	/* The subtle arrow animation */
	.tool-arrow {
		opacity: 0;
		transition:
			opacity 0.2s,
			transform 0.2s;
	}

	.tool-card:hover .tool-arrow {
		opacity: 1;
		transform: translateX(4px);
	}

	.tool-card p {
		font-size: 0.85rem;
		color: var(--gray);
		margin-bottom: 0;
		line-height: 1.5;
	}
</style>
