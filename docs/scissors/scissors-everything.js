export const values = [
	[{ text: `Kai`, link: `https://amzn.to/3DiMzSB` }, 254, 73, 220, 290, 330, 335, 460, 1 ],
	[{ text: `Gingher`, link: `https://amzn.to/3Eo3MLK` }, 171, 31, 245, 310, 375, 350, 550, 2 ],
	[{ text: `Klein Tools`, link: `https://amzn.to/3DAPcPT` }, 167, 24, 270, 320, 420, 435, 645, 2 ],
	[{ text: `Heritage`, link: `` }, 215, 28, 345, 410, 450, 490, 730, 2 ],
	[{ text: `Fiskars`, link: `https://amzn.to/3DlbAwh` }, 126, 21, 355, 400, 410, 435, 725, 1 ],
	[{ text: `Livingo`, link: `https://amzn.to/31yzJSI` }, 109, 13, 390, 440, 520, 555, 1000, 3 ],
	[{ text: `Bianco`, link: `https://amzn.to/3ppQnwg` }, 130, 20, 395, 485, 570, 590, 1235, 3 ],
	[{ text: `Henchels`, link: `https://amzn.to/3rAsC7B` }, 91, 22, 295, 460, 525, 635, 770, 2 ],
	[{ text: `Scotch`, link: `https://amzn.to/32NrOld` }, 77, 4, 410, 545, 585, 630, 1175, 3 ],
	[{ text: `Ultima Classic`, link: `https://amzn.to/3prbput` }, 195, 19, 410, 440, 485, 510, 945, 3 ],
	[{ text: `KitchenAid`, link: `https://amzn.to/3ow3sVP` }, 122, 9, 470, 515, 585, 635, 1270, 2 ],
	[{ text: `Westscott`, link: `https://amzn.to/3Gb2Yu7` }, 161, 14, 475, 525, 585, 610, 780, 5 ],
	[{ text: `Singer`, link: `https://amzn.to/2ZWRDOQ` }, 67, 6, 560, 570, 700, 685, 1240, 3 ],
	[{ text: `Acme`, link: `https://amzn.to/31wWQgt` }, 185, 18, 575, 595, 675, 705, 1190, 3 ],
	[{ text: `Stanley`, link: `https://amzn.to/3lzIKCy` }, 92, 3.5, 610, 1015, 1075, 1230, 1650, 3 ],
]

export const columns = [
	{ name: `Brand` },
	{ name: `Weight (grams)`, type: `number` },
	{ name: `Cost`, type: `number`, fixed: 2 },
	{ name: `Initial sharpness`, type: `number` },
	{ name: `Sharpness after 1000 cuts`, type: `number` },
	{ name: `Sharpness after cardboard`, type: `number` },
	{ name: `Sharpness after aluminum`, type: `number` },
	{ name: `Sharpness after sandpaper`, type: `number` },
	{ name: `Subjective ease of use/comfort`, type: `number` },
]

export const identifier = `ScissorsEverything`
