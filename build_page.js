const rollup = require(`rollup`)
const fs = require(`fs/promises`)

const svelte = require(`rollup-plugin-svelte`)
const resolve = require(`rollup-plugin-node-resolve`)
const make_dir = require(`make-dir`)

const [ ,, page_name ] = process.argv

const dev = true

const build_html = async({ page_name }) => {
	const page_path = `pages/${page_name}/Index.svelte`

	const template = await fs.readFile(`./template.html`, { encoding: `utf8` })

	const bundle = await rollup.rollup({
		input: page_path,
		plugins: [
			svelte({
				compilerOptions: {
					dev,
					generate: `ssr`,
					hydratable: true,
				},
				emitCss: false,
			}),
			resolve(),
		],
	})

	await bundle.write({
		// name: page_name,
		file: `./tmp.js`,
		format: `cjs`,
	})

	const Page = require(`./tmp.js`)

	const { html, css, head } = Page.render()

	const output = template.replace(`<!-- content -->`, `
		${html}
		<style>
			${css.code}
		</style>
		<script src="./hydrate.js"></script>
	`).replace(`<!-- head -->`, head)

	make_dir(`public/${page_name}`)

	await fs.writeFile(`public/${page_name}/index.html`, output)
}

const build_hydration_script = async({ page_name }) => {
	const script_path = `pages/${page_name}/hydrate.js`

	const bundle = await rollup.rollup({
		input: script_path,
		plugins: [
			svelte({
				compilerOptions: {
					dev,
					hydratable: true,
				},
				emitCss: false,
			}),
			resolve(),
		],
	})

	await bundle.write({
		name: page_name,
		file: `public/${page_name}/hydrate.js`,
		format: `iife`,
	})
}

build_html({ page_name }).then(
	() => build_hydration_script({ page_name }),
).then(() => {
	console.log(`👌`)
}).catch(err => {
	console.error(err)
	process.exit(1)
})
