<svelte:head>
	<title>Best Scissors</title>
</svelte:head>

<script>
	import Table from '../../table/Table.svelte'
	import { values, columns, identifier } from './scissors-everything.js'
</script>

<h1>Scissors!</h1>

<p>YouTube embed</p>

<Table {values} {columns} {identifier} />

<p>
	Content here probably
</p>
