<ul>
	<slot></slot>
</ul>

<style>
	ul {
		display: grid;
		grid-template-columns: 1fr 1fr;
		justify-content: space-between;
		grid-gap: 8px;
		padding: 0;
		margin: 0;
	}

	@media (max-width: 500px) {
		ul {
			grid-template-columns: 1fr;
			justify-content: center;
		}
	}
</style>
