export interface Segment {
	text: string;
	marked: boolean;
}
export function segmentByIndices(
	text: string,
	indices: readonly number[],
): Segment[] {
	const matched = new Set(indices);
	const parts: Segment[] = [];
	for (let i = 0; i < text.length; i++) {
		const marked = matched.has(i);
		const last = parts[parts.length - 1];
		if (last && last.marked === marked) last.text += text[i];
		else parts.push({ text: text[i], marked });
	}
	return parts;
}
