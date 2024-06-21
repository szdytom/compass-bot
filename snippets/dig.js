// .load snippets/dig.js

async function holdPickaxe() {
	const pickaxes = new Set(
		['stone_pickaxe', 'iron_pickaxe', 'diamond_pickaxe', 'netherite_pickaxe']
			.map(name => mcdata.itemsByName[name].id)
	);

	if (pickaxes.has(bot.heldItem?.type)) return;

	for (let item of bot.inventory.slots) {
		if (pickaxes.has(item?.type)) {
		    await bot.equip(item, 'hand');
			return;
		}
	}

	throw new Error('No pickaxe in inventory!');
}

async function holdTorch() {
	const torch = mcdata.itemsByName['torch'].id;
	if (bot.heldItem?.type === torch) return;
	
	for (let item of bot.inventory.slots) {
	    if (item?.type === torch) {
	        await bot.equip(item, 'hand');
			return;
	    }
	}

	throw new Error('No torch in inventory!');
}

async function digChamber(axis_name, dis, width_axis_name, width = 5, height = 3) {
    let axis = lib.cctl.AXIS[axis_name];
	let width_axis = lib.cctl.AXIS[width_axis_name];
	await bot.look(axis * Math.PI, 0);
	bot.cctl.centralizeXZ();
	bot.clearControlStates();
	
	try {
		let p = bot.entity.position.floor();
		let dm = lib.cctl.AXIS_UNIT[axis].clone(), dw = lib.cctl.AXIS_UNIT[width_axis].clone();
		for (let i = 1; i <= dis; i += 1) {
			for (let j = 0; j < width; j += 1) {
				if (j == 0) {
					await bot.look(axis * Math.PI, 0);
					bot.setControlState('forward', true);
				}
				for (let k = height - 1; k >= 0; k -= 1) {
				    let pos = p.plus(dm.scaled(i).plus(dw.scaled(j).plus(new Vec3(0, k, 0))));
					let b = bot.blockAt(pos);
					if (b != null && b.type != 0) {
					    await holdPickaxe();
						await bot.dig(b, j == 0 ? 'ignore' : true);
					}
				}

				if (j == 0) {
					bot.setControlState('forward', false);	
					bot.cctl.centralizeXZ();
				}
			}

			if (i % 5 == 1) {
				await holdTorch();
				let pos = p.plus(dm.scaled(i)).plus(dw.scaled(width - 1)).plus(new Vec3(0, -1, 0));
				await bot.placeBlock(bot.blockAt(pos), new Vec3(0, 1, 0));
			}
		}
	} catch(err) {
	    bot.setControlState('forward', false);
		throw err;
	}
	bot.setControlState('forward', false);
}
