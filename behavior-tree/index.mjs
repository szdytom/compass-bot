
export class BehaviorTree {
	constructor(root) {
		this.root = root;
	}
};

export class Node {
	constructor() {}
};

export class ExecutionNode extends Node {
	constructor() {
		super();
	}

	isLeaf() { return true; }
};

export class ControlNode extends Node {
	constructor() {
		super();
		this.children = [];
	}

	isLeaf() { return false; }
	appendChild(child) {
		this.children.push(child);
		return this;
	}
};

export class SequenceNode extends ControlNode {
	constructor() { super(); }

	async tick(blackboard) {
		for (let child of this.children) {
			await child.tick(blackboard);
		}
	}
};

export class FallbackNode extends ControlNode {
	constructor() { super(); }

	async tick(blackboard) {
		for (let i = 0; i < this.children.length; i += 1) {
			let child = this.children[i];
			try {
				await child.tick(blackboard);
				break;
			} catch(err) {
				if (i == this.children.length - 1) { throw err; }
			}
		}
	}
};

export class ParallelNode extends ControlNode {
	constructor() { super(); }

	tick(blackboard) {
		return Promise.all(this.children.map(child => child(blackboard)));
	}
}
