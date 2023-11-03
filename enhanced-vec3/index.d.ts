import { Vec3 } from 'vec3';

declare module 'vec3' {
	export interface Vec3 {
		setXZ(x: number, z: number): Vec3;
		setXY(x: number, y: number): Vec3;
		setYZ(y: number, z: number): Vec3;
		updateXZ(other: Vec3): Vec3;
		xzNorm(): number;
		dotXZ(other: Vec3): number;
		crossXZ(other: Vec3): number;
		offsetXZ(x: number, z: number): Vec3;
		centralizeXZ(): Vec3;
		updateXY(other: Vec3): Vec3;
		updateYZ(other: Vec3): Vec3;
		xyNorm(): number;
		yzNorm(): number;
		dotXY(other: Vec3): number;
		dotYZ(other: Vec3): number;
		crossXY(other: Vec3): number;
		crossYZ(other: Vec3): number;
		offsetXY(x: number, y: number): Vec3;
		offsetYZ(y: number, z: number): Vec3;
		centralizeXY(): Vec3;
		centralizeYZ(): Vec3;
		centralize(): Vec3;
		xzNormSquared(): number;
		xyNormSquared(): number;
		yzNormSquared(): number;
	}
}
