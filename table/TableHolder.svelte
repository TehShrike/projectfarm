<div class="table_holder">
	<slot></slot>
</div>

<style>
	.table_holder {
		width: 100%;
		max-width: 1000px;
		display: flex;
	}

	@media screen and (max-width: 800px) {
		.table_holder {
			overflow-x: scroll;
		}
	}
</style>
