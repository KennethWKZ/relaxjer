// Taipei (and New Taipei): the city's metro name, taxi meter and bike share. Pure; merged over the country pack
// (destinations/tw/pack.mjs) when TRIP.region is 'taipei'.

export const city = ['台北', 'Taipei'];
export const metro = ['捷运', 'MRT'];
/** the stored-value transit card */
export const transitCard = ['悠游卡', 'EasyCard'];
/** a metro toilet inside the gates: the station lets you through for free */
export const metroToiletTip = [
	'捷运站厕所若在闸门内：向询问处要免费「临时通行票」，15分钟内同站进出，不用刷卡。',
	'MRT toilet inside the gates? Ask the info counter for a free temporary pass: 15 min, same station, no fare.',
];

/**
 * Taipei taxi meter for a straight-line distance: the road is ~1.3× longer; NT$85 for the first 1.25 km, NT$5 per
 * 200 m after, NT$20 more from 23:00 to 06:00. Returns a [low, high] range per car, to the nearest 10 (high = +20%
 * for traffic and waiting).
 */
export function taxiFare(km, minsNow) {
	const road = km * 1.3;
	const night = minsNow >= 1380 || minsNow < 360 ? 20 : 0;
	const base = 85 + Math.max(0, Math.ceil((road - 1.25) / 0.2)) * 5 + night;
	const r10 = (v) => Math.round(v / 10) * 10;
	return [r10(base), r10(base * 1.2)];
}

/** YouBike 2.0 live dock counts: the request for some station numbers, and its answer as { no, bikes, docks, on } */
export const bikeShare = {
	name: ['YouBike', 'YouBike'],
	system: ['YouBike 2.0', 'YouBike 2.0'],
	request: (nos) => ({
		url: 'https://apis.youbike.com.tw/tw2/parkingInfo',
		init: { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ station_no: nos }) },
	}),
	parse: (json) =>
		((json.retVal || {}).data || []).map((x) => ({ no: String(x.station_no), bikes: x.available_spaces, docks: x.empty_spaces, on: x.status === 1 })),
};
