<script>
	export let direction = 0
</script>

<span class=container data-sort-direction={direction} on:click>
	<span class=up>
		▲
	</span>
	<span class=down>
		▼
	</span>
</span>

<style>
	.container {
		font-size: 12px;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 1vh; /* I'll regret this, right? */
		height: 100%;
		color: #e4e4e4;
	}
	[data-sort-direction='1'] .down {
		color: var(--accent-color);
	}
	[data-sort-direction='-1'] .up {
		color: var(--accent-color);
	}

</style>
