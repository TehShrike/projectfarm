import svelte from 'rollup-plugin-svelte'
import css from 'rollup-plugin-css-only'

const dev = process.env.ROLLUP_WATCH

export default {
	input: `pages/scissors/Index.svelte`,
	output: {
		file: `public/index.js`,
		format: `iife`,
		sourcemap: dev,
	},
	watch: { clearScreen: false },
	plugins: [
		svelte({
			compilerOptions: {
				dev,
			},
			emitCss: true,
		}),
		css({
			output: `table.css`,
		}),
	],
}
