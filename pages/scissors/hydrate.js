import Table from '../../table/Table.svelte'

import { values, columns, identifier } from './scissors-everything.js'

const selector = `[data-table-identifier=${identifier}]`

new Table({
	target: document.querySelector(selector),
	props: {
		values,
		columns,
		identifier,
	},
	hydrate: true,
})
