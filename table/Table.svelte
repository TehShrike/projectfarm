<script>
	import Arrows from './Arrows.svelte'
	export let columns
	export let values
	export let identifier
	
	const sort_directions = {
		asc: 1,
		none: 0,
		desc: -1,
	}

	const get_column_sort = (target_column, sorts) => {
		const found = sorts.find(({ column }) => column === target_column)
		return found
	}

	const get_actual_value = row_element => typeof row_element === `object`
		? row_element.text
		: row_element

	const display_column = (column, value) => {
		const is_number = typeof column === `object` && column.type === `number` && `fixed` in column
		const actual_value = get_actual_value(value)

		if (is_number) {
			return actual_value.toFixed(column.fixed)
		}

		return actual_value
	}

	const get_next_sort_direction = current_direction => {
		if (current_direction === sort_directions.none) {
			return sort_directions.desc
		} else if (current_direction === sort_directions.desc) {
			return sort_directions.asc
		} else if (current_direction === sort_directions.asc) {
			return sort_directions.none
		}
	}

	let sorts = []

	const apply_sort = column_index => {
		const clicked_column = columns[column_index]
		const current_sort_index = sorts.findIndex(({ column }) => column === clicked_column)

		const current_sort_direction = current_sort_index !== -1
			? sorts[current_sort_index].direction
			: sort_directions.none

		if (current_sort_index !== -1) {
			sorts.splice(current_sort_index, 1)
			sorts = sorts
		}

		const next_sort_direction = get_next_sort_direction(current_sort_direction)

		sorts = next_sort_direction === sort_directions.none
			? sorts
			: [
				...sorts,
				{
					column_index,
					column: clicked_column,
					direction: get_next_sort_direction(current_sort_direction),
				},
			]
	}

	$: sorted_rows = values.slice().sort(
		(row_a, row_b) => sorts.reduceRight(
			(sort_order, { column_index, direction }) => {
				if (sort_order !== 0) {
					return sort_order
				}

				const value_a = row_a[column_index]
				const value_b = row_b[column_index]

				if (value_a === value_b) {
					return 0
				} else if (value_a < value_b) {
					return direction
				} else {
					return -direction
				}
			},
			sort_directions.none,
		),
	)
</script>

<table data-table-identifier={identifier}>
	<thead>
		<tr>
			{#each columns as column, column_index}
				<th
					data-type={column.type || `string`}
					on:click|preventDefault={() => apply_sort(column_index)}
				>
					{column.name}
					<span class=arrows>
						<Arrows direction={get_column_sort(column, sorts)?.direction} />
					</span>
				</th>
			{/each}
		</tr>
	</thead>
	<tbody>
		{#each sorted_rows as row}
			<tr>
				{#each columns as column, index}
					<td data-type={column.type}>
						{#if typeof row[index] === `object`}
							<a href={row[index].link}>
								{display_column(column, row[index])}
							</a>
						{:else}
							{display_column(column, row[index])}
						{/if}
					</td>
				{/each}
			</tr>
		{/each}
	</tbody>
</table>

<style>
	table {
		border-collapse: collapse;
		--accent-color: rgb(220, 53, 41);
		--background-accent-color: rgba(254, 251, 251);
	}
	th {
		text-align: left;

		padding: 8px;
		vertical-align: bottom;
		cursor: pointer;
		padding-right: 18px
	}
	th, td {
		border: 1px solid gray;
	}
	th[data-type=number], td[data-type=number] {
		text-align: right;
	}
	td {
		padding: 4px 8px;
	}
	td[data-type=number] {
		font-variant-numeric: tabular-nums;
	}
	tbody tr:nth-child(2n) {
		background-color: var(--background-accent-color);
	}
	
	th {
		position: relative;
	}
	.arrows {
		position: absolute;
		right: 2px;
		top: 0;
		height: 100%;
	}
</style>
