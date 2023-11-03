import { Vec3 } from 'vec3';

Vec3.prototype.setXZ = function setXZ(x, z) {
	this.x = x;
	this.z = z;
	return this;
};

Vec3.prototype.setXY = function setXY(x, y) {
	this.x = x;
	this.y = y;
	return this;
};

Vec3.prototype.setYZ = function setYZ(y, z) {
	this.y = y;
	this.z = z;
	return this;
};

Vec3.prototype.updateXZ = function updateXZ(other) {
	this.x = other.x;
	this.z = other.z;
	return this;
};

Vec3.prototype.xzNorm = function xzNorm() {
	return Math.sqrt((this.x * this.x) + (this.z * this.z));
};

Vec3.prototype.dotXZ = function dotXZ(other) {
	return (this.x * other.x) + (this.z * other.z);
};

Vec3.prototype.crossXZ = function crossXZ(other) {
	return (this.x * other.z) - (this.z * other.x);
};

Vec3.prototype.offsetXZ = function offsetXZ(x, z) {
	this.x += x;
	this.z += z;
	return this;
};

Vec3.prototype.centralizeXZ = function centralizeXZ() {
	this.x = Math.floor(this.x) + .5;
	this.z = Math.floor(this.z) + .5;
	return this;
};

Vec3.prototype.updateXY = function updateXY(other) {
	this.x = other.x;
	this.y = other.y;
	return this;
};

Vec3.prototype.updateYZ = function updateYZ(other) {
	this.y = other.y;
	this.z = other.z;
	return this;
};

Vec3.prototype.xyNorm = function xyNorm() {
	return Math.sqrt((this.x * this.x) + (this.y * this.y));
};

Vec3.prototype.yzNorm = function yzNorm() {
	return Math.sqrt((this.y * this.y) + (this.z * this.z));
};

Vec3.prototype.dotXY = function dotXY(other) {
	return (this.x * other.x) + (this.y * other.y);
};

Vec3.prototype.dotYZ = function dotYZ(other) {
	return (this.y * other.y) + (this.z * other.z);
};

Vec3.prototype.crossXY = function crossXY(other) {
	return (this.x * other.y) - (this.y * other.x);
};

Vec3.prototype.crossYZ = function crossYZ(other) {
	return (this.y * other.z) - (this.z * other.y);
};

Vec3.prototype.offsetXY = function offsetXY(x, y) {
	this.x += x;
	this.y += y;
	return this;
};

Vec3.prototype.offsetYZ = function offsetYZ(y, z) {
	this.y += y;
	this.z += z;
	return this;
};

Vec3.prototype.centralizeXY = function centralizeXY() {
	this.x = Math.floor(this.x) + .5;
	this.y = Math.floor(this.y) + .5;
	return this;
};

Vec3.prototype.centralizeYZ = function centralizeYZ() {
	this.y = Math.floor(this.y) + .5;
	this.z = Math.floor(this.z) + .5;
	return this;
};

Vec3.prototype.centralize = function centralize() {
	this.x = Math.floor(this.x) + .5;
	this.y = Math.floor(this.y) + .5;
	this.z = Math.floor(this.z) + .5;
	return this;
};

Vec3.prototype.xzNormSquared = function xzNormSquared() {
	return this.x * this.x + this.z * this.z;
};

Vec3.prototype.xyNormSquared = function xyNormSquared() {
	return this.x * this.x + this.y * this.y;
};

Vec3.prototype.yzNormSquared = function yzNormSquared() {
	return this.y * this.y + this.z * this.z;
};
