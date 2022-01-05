<script>
	export let title = null
	export let img = null
	export let alt = null
	export let link = null
</script>

<li>
	<a
		href={link}
		target="blank"
		rel="external nofollow noopener"
	>
		<strong>
			{title}
		</strong>

		<div class=image_container>
			<img src={img} {alt} />
		</div>

		<slot></slot>
	</a>
</li>

<style>
	li {
		list-style-type: none;
		border: 1px solid var(--black);
		border-radius: 4px;
		--padding: 8px;
	}

	a {
		height: 100%;
		display: grid;
		grid-template-rows: 2em 2fr 1fr;
		text-decoration: none;
	}

	strong {
		display: flex;
		align-items: center;
		padding: 0 var(--padding);
		text-decoration: underline;
	}

	.image_container {
		height: 100%;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		background-color: var(--black)
	}

	li * {
		width: 100%;
	}

	li :global(p) {
		padding: var(--padding);
		color: initial;
	}
</style>
