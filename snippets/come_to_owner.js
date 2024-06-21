// .load snippets/come_to_owner.js

async function comeToOwner() {
    let target = sc.owner();
    if (!target) {
        console.log("Owner not found");
        return;
    }

    const pos = target.entity.position;
    bot.pathfinder.setMovements(new lib.pf.Movements(bot));
    bot.pathfinder.setGoal(new lib.pf.default.goals.GoalNear(pos.x, pos.y, pos.z, 1));
}
