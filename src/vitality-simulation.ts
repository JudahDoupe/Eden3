import { Color } from "three";

const MIN_VITALITY = 0;
const MAX_VITALITY = 10;
const BROWN_BOUNDARY = 1;

const COLOR_BLACK = new Color(0x000000);
const COLOR_BROWN = new Color(0xA52A2A);
const COLOR_GREEN = new Color(0x32cd32); // LimeGreen for clear visual distinction

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

export interface VitalityState {
	vitality: number;
	color: Color;
}

export class VitalitySimulator {
	private _vitality: number = MIN_VITALITY;

	get vitality(): number {
		return this._vitality;
	}

	setVitality(val: number): void {
		this._vitality = clamp(val, MIN_VITALITY, MAX_VITALITY);
	}

	accumulate(dt: number): void {
		this.setVitality(this._vitality + dt * 2);
	}

	get currentState(): VitalityState {
		const v = this._vitality;
		let color: Color;

		if (v <= MIN_VITALITY) {
			color = COLOR_BLACK.clone();
		} else if (v >= MAX_VITALITY) {
			color = COLOR_GREEN.clone();
		} else if (v < BROWN_BOUNDARY) {
			const t = clamp((v - MIN_VITALITY) / BROWN_BOUNDARY, 0, 1);
			color = COLOR_BLACK.clone().lerp(COLOR_BROWN, t);
		} else {
			const t = clamp(
				(v - BROWN_BOUNDARY) / (MAX_VITALITY - BROWN_BOUNDARY),
				0,
				1
			);
			color = COLOR_BROWN.clone().lerp(COLOR_GREEN, t);
		}

		return { vitality: this._vitality, color };
	}
}