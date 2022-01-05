<svelte:head>
	<title>Best Scissors</title>
</svelte:head>

<script>
	import Table from '../../table/Table.svelte'
	import TableHolder from '../../table/TableHolder.svelte'

	import Cards from './Cards.svelte'
	import Card from './Card.svelte'

	import { values, columns, identifier, affiliate_links } from './scissors-everything.js'
</script>

<h1>Scissors!</h1>

<p>
	Is a $3 pair as good as a pair that costs $73?
</p>

<iframe height="315" src="https://www.youtube.com/embed/koqa9YgcmuU" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

<p>
	In the first test we'll test the sharpness of the scissors after they cut through paper the length of three football fields.
</p>
<p>
	Then we'll test the sharpness after they cut through cardboard.  We'll see if cutting aluminum actually sharpens the scissors, then we'll see which brand holds up the best after cutting through sandpaper.
</p>

<p>
	Finally we'll sharpen some scissors after they become really dull from all the testing.
</p>

<p>
	<strong>Sharpness numbers:</strong> for context, a double edge razor blade is around 50, a utility blade is anywhere from 150 to 200, and a new high-end cutlery edge is anywhere from 250 to 350.
</p>

<TableHolder>
	<Table {values} {columns} {identifier} />
</TableHolder>

<h2>Favorites</h2>

<Cards>
	<Card
		title="Kai"
		img="./img/kai.jpg"
		alt="Kai brand scissors held in a hand"
		link={affiliate_links.kai}
	>
		<p>These are definitely the best, but they're also twice as expensive as any of the other brands.</p>
	</Card>
	<Card
		title="KitchenAid"
		img="./img/kitchenaid.jpg"
		alt="KitchenAid brand scissors held in a hand"
		link={affiliate_links.kitchenaid}
	>
		<p>If you want to spend as little as possible, these are very comfortable and do a great job.</p>
	</Card>
	<Card
		title="Fiskars"
		img="./img/fiskars.jpg"
		alt="Fiskars brand scissors held in a hand"
		link={affiliate_links.fiskars}
	>
		<p>If you want to spend a bit more, the Fiskars are sharp and perform well.</p>
	</Card>
	<Card
		title="Klein Tools"
		img="./img/klein.jpg"
		alt="Klein brand scissors held in a hand"
		link={affiliate_links.kleintools}
	>
		<p>These are very sharp and will last a long time.</p>
	</Card>
</Cards>

