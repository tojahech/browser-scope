export interface Segment {
	text: string;
	highlighted: boolean;
}

/** Split `text` into contiguous runs of matched / unmatched characters. */
export function segmentByIndices(text: string, indices: number[]): Segment[] {
	if (text.length === 0) return [];
	const matched = new Set(indices);
	const segments: Segment[] = [];
	let run = text[0];
	let runHighlighted = matched.has(0);
	for (let i = 1; i < text.length; i++) {
		const highlighted = matched.has(i);
		if (highlighted === runHighlighted) {
			run += text[i];
		} else {
			segments.push({ text: run, highlighted: runHighlighted });
			run = text[i];
			runHighlighted = highlighted;
		}
	}
	segments.push({ text: run, highlighted: runHighlighted });
	return segments;
}
