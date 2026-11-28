/* Demo trip: a fictional party of six, six days in Sapporo and Otaru, with a day's drive to Asahikawa (Sat – Thu, February).
   Dates live only in date fields, never in text: the live demo moves them into each visitor's own year
   (engine/src/app/01-demo-year.js), and a date written into a sentence would stay behind.
   Synthetic and safe to publish. Hotel, flights, shops, restaurants and prices are invented; landmarks are public places.
   Nothing here is copied from Google. Costs for the whole party are written "¥a–b / 六人" and "¥a–b for 6"
   (the currency symbol and party size come from TRIP) so the page adds the per-person share. */

const TRIP = {
	name: ['札幌示范行', 'Sapporo demo trip'],
	start: '2027-02-06',
	end: '2027-02-11',
	brand: '札幌示范行', // brush lettering, page title, home-screen name
	brandShort: '札幌行', // the header's name on a phone too narrow for the whole brand
	description: '示范：六人札幌六天 · Demo: six days in Sapporo for 6',
	pax: 6, // party size: every "for 6" figure also shows a share each
	tz: 'Asia/Tokyo', // the destination's clock, whatever the phone says
	// the destination pack: destinations/jp (tax-free, native layer) + regions/sapporo (subway, taxi meter, IC card, Snow Light Path look)
	destination: 'jp',
	region: 'sapporo',
	currency: { sym: '¥', home: 'HKD', rate: 19.5, rateNote: ['示范汇率，出发前改成当天汇率', 'Demo rate; update before the trip'] },
	checked: '2027-01-30', // when hours and prices were last checked
	arriveCity: ['新千岁机场', 'New Chitose Airport'],
	forecastSpot: 'sapporo', // which forecast.json spot a day reads unless it names its own
	searchHint: ['搜索：温泉、下雪、¥、拉面…', 'Search: onsen, snow, ¥, ramen…'],
	footer: ['示范行程：地点是真实的，旅店、航班、价格都是虚构的。', 'Demo trip: the places are real; the hotel, flights and prices are made up.'],
	mapViews: [
		// map area buttons; the map opens on the first
		{ id: 'city', name: ['札幌市区', 'Sapporo city'], bbox: [141.32, 43.03, 141.4, 43.09] },
		{ id: 'otaru', name: ['小樽', 'Otaru'], bbox: [140.95, 43.15, 141.05, 43.23] },
		{ id: 'ski', name: ['雪场与定山渓', 'Ski area and Jōzankei'], bbox: [141.08, 42.94, 141.24, 43.1] },
		{ id: 'airport', name: ['机场', 'Airport'], bbox: [141.6, 42.75, 141.7, 42.84] },
		{ id: 'asahikawa', name: ['去旭川的路', 'The drive to Asahikawa'], bbox: [141.3, 43.0, 142.55, 43.82] },
	],
	shopDays: [
		// {dN} = that day's date, {back} = the time to collect the bags on the last day
		{
			ok: true,
			zh: '<b>{d4} 购物日</b>：狸小路和百货，买完寄放在酒店',
			en: '<b>{d4} shopping day</b>: Tanukikoji and the department stores; leave purchases at the hotel',
		},
		{
			ok: false,
			zh: '<b>不建议大采购</b>：{d1}刚落地带行李、{d3}在雪场',
			en: '<b>Not for big shopping</b>: {d1} arriving with suitcases, {d3} on the snow',
		},
	],
	kml: { optional: '备选 Optional', transport: ['hotel', 'cts', 'airportStn', 'sapStn'] },
	addStopNote: [
		'第6天上午是最后一次出门。只存在这支手机；用「分享」把链接发给大家。',
		'The last morning is a free walk. Saved on this phone; use Share to send it to the others.',
	],
	hotelSlots: ['bk-hotel'],
};

const PLACES = {
	hotel: {
		name: ['示范旅店 大通', 'Sample Inn Odori'],
		maps: 'Odori Park Sapporo',
		trad: 'デモイン大通',
		roma: 'Demoin Ōdōri',
		addr: '札幌市中央区大通西（示范地址）',
		addrEn: 'Odori-nishi, Chuo-ku, Sapporo (demo address)',
		note: ['大通站步行约5分钟（示范）', '5 min walk from Odori Station (demo)'],
	},
	cts: {
		name: ['新千岁机场', 'New Chitose Airport'],
		maps: 'New Chitose Airport',
		trad: '新千歳空港',
		roma: 'Shin-Chitose Kūkō',
		site: 'https://www.new-chitose-airport.jp/',
	},
	airportStn: {
		name: ['JR 新千岁机场站', 'JR New Chitose Airport Station'],
		maps: 'JR New Chitose Airport Station',
		trad: '新千歳空港駅',
		roma: 'Shin-Chitose-kūkō-eki',
	},
	sapStn: { name: ['札幌站', 'Sapporo Station'], maps: 'Sapporo Station', trad: '札幌駅', roma: 'Sapporo-eki' },
	odori: { name: ['大通公园', 'Odori Park'], maps: 'Odori Park', trad: '大通公園', roma: 'Ōdōri Kōen' },
	tvTower: { name: ['札幌电视塔', 'Sapporo TV Tower'], maps: 'Sapporo TV Tower', trad: 'さっぽろテレビ塔', roma: 'Sapporo Terebi-tō' },
	susukino: { name: ['薄野', 'Susukino'], maps: 'Susukino Sapporo', trad: '薄野', roma: 'Susukino' },
	tanuki: {
		name: ['狸小路商店街', 'Tanukikoji Shopping Street'],
		maps: 'Tanukikoji Shopping Street Sapporo',
		trad: '狸小路商店街',
		roma: 'Tanuki-kōji Shōtengai',
	},
	nijo: { name: ['二条市场', 'Nijo Market'], maps: 'Nijo Market Sapporo', trad: '二条市場', roma: 'Nijō Ichiba' },
	shiroi: { name: ['白色恋人公园', 'Shiroi Koibito Park'], maps: 'Shiroi Koibito Park', trad: '白い恋人パーク', roma: 'Shiroi Koibito Pāku' },
	otaruStn: { name: ['小樽站', 'Otaru Station'], maps: 'Otaru Station', trad: '小樽駅', roma: 'Otaru-eki' },
	otaruCanal: { name: ['小樽运河', 'Otaru Canal'], maps: 'Otaru Canal', trad: '小樽運河', roma: 'Otaru Unga' },
	sakaimachi: { name: ['堺町通', 'Sakaimachi Street'], maps: 'Sakaimachi Street Otaru', trad: '堺町通り', roma: 'Sakaimachi-dōri' },
	music: { name: ['小樽音乐盒堂', 'Otaru Music Box Museum'], maps: 'Otaru Music Box Museum', trad: '小樽オルゴール堂', roma: 'Otaru Orugōru-dō' },
	teine: { name: ['札幌手稻雪场', 'Sapporo Teine'], maps: 'Sapporo Teine ski resort', trad: 'サッポロテイネ', roma: 'Sapporo Teine' },
	jozankei: { name: ['定山渓温泉', 'Jōzankei Onsen'], maps: 'Jozankei Onsen', trad: '定山渓温泉', roma: 'Jōzankei Onsen' },
	moiwa: { name: ['藻岩山缆车', 'Mount Moiwa Ropeway'], maps: 'Mount Moiwa Ropeway', trad: '藻岩山ロープウェイ', roma: 'Moiwayama Rōpuwei' },
	zoo: { name: ['旭山动物园', 'Asahiyama Zoo'], maps: 'Asahiyama Zoo', trad: '旭山動物園', roma: 'Asahiyama Dōbutsuen' },
};

const SITES = {
	vjw: { name: ['Visit Japan Web', 'Visit Japan Web'], url: 'https://vjw-lp.digital.go.jp/' },
	jr: { name: ['JR 北海道', 'JR Hokkaido'], url: 'https://www.jrhokkaido.co.jp/' },
	sapica: { name: ['SAPICA 交通卡', 'SAPICA transit card'], url: 'https://www.sapica.jp/' },
	subway: { name: ['札幌市营地铁', 'Sapporo Subway'], url: 'https://www.city.sapporo.jp/st/josyaken/' },
	lesson: { name: ['滑雪课预约（示范）', 'Ski lesson booking (demo)'], url: 'https://example.org/demo-lesson' },
	demoTaxi: { name: ['示范车行', 'Demo taxi company'], url: 'https://example.org/demo-taxi' },
	jma: { name: ['日本气象厅', 'Japan Meteorological Agency'], url: 'https://www.jma.go.jp/' },
	nta: { name: ['国税厅（退税）', 'National Tax Agency (tax-free)'], url: 'https://www.nta.go.jp/' },
};

const FACTS = [
	{ k: ['日期', 'Dates'], v: ['二月，周六到周四，六天', 'A six-day trip in February, Saturday to Thursday'] },
	{ k: ['人数', 'Party'], v: ['6人（两人走得慢一些）', '6 people, two of us walk more slowly'] },
	{ k: ['住宿', 'Stay'], v: ['示范旅店 大通（5晚）', 'Sample Inn Odori (5 nights)'], place: 'hotel' },
	{ k: ['节奏', 'Pace'], v: ['每天2–3个地方，午后休息', '2–3 stops a day, a rest after lunch'] },
];

const BACKUPS = [
	['下雪大：室内的白色恋人公园和狸小路', 'Heavy snow: indoors at Shiroi Koibito Park and Tanukikoji'],
	['累了：回酒店休息，晚上再出门', 'Tired: rest at the hotel, go out again in the evening'],
	['藻岩山缆车夜景（备选）', 'Mount Moiwa ropeway at night (optional)'],
];

const DAYS = [
	{
		id: 'd1',
		n: 1,
		date: '2027-02-06',
		dow: ['六', 'Sat'],
		c: 1,
		motif: 'plane',
		foodSlots: ['d1-ramen'],
		freeEvening: true, // wishlist items that fit "any evening" are suggested here
		wish: '平安到',
		gloss: ['', 'Arrive safe'],
		mealAt: [[/晚餐/, [['dinner', ['d1-ramen']]]]],
		route: [
			['cts', 'airportStn', 'transit'],
			['airportStn', 'sapStn', 'transit', 37],
			['sapStn', 'hotel', 'walking'],
			['hotel', 'odori', 'walking'],
			['odori', 'susukino', 'transit'],
		],
		tickets: ['ic-buy'],
		title: ['机场 → 札幌站 → 酒店 → 大通公园夜景', 'Airport → Sapporo Station → hotel → Odori Park lights'],
		short: ['抵达 · 大通夜景', 'Arrive · Odori lights'],
		focus: ['落地、入住、轻松晚餐', 'Land, check in, an easy dinner'],
		photos: [],
		wear: ['厚外套 + 防滑鞋', 'Thick coat + grippy boots'],
		budgetChip: ['约 ¥11,400–12,400', '~¥11,400–12,400'],
		schedule: [
			{
				t: '15:00',
				rel: { arr: [0] },
				what: ['降落新千岁机场', 'Land at New Chitose'],
				fixed: true,
				place: 'cts',
				note: ['入境、领行李约60分钟', 'Immigration and bags ~60 min'],
			},
			{
				t: '~15:00–16:05',
				rel: { arr: [0, 65], about: 1 },
				what: ['入境、领行李、买交通卡', 'Immigration, bags, a transit card'],
				place: 'cts',
				note: ['交通卡在 JR 站或售票机买', 'Transit cards at the JR station or a ticket machine'],
			},
			{
				t: '~16:10–16:50',
				rel: { arr: [70, 110], about: 1 },
				what: ['JR 快速机场到札幌站', 'JR Rapid Airport to Sapporo Station'],
				place: 'airportStn',
				note: ['约37分钟，车上有行李架', 'About 37 min; luggage racks on board'],
			},
			{
				t: '~16:50–17:15',
				rel: { arr: [110, 140], about: 1 },
				what: ['札幌站到酒店，步行或地铁', 'Sapporo Station to the hotel, on foot or by subway'],
				place: 'sapStn',
				note: ['行李多就叫一辆车', 'Lots of bags: take a taxi'],
			},
			{
				t: '17:30',
				what: ['酒店入住，休息', 'Hotel check-in, rest'],
				place: 'hotel',
				note: ['先休息，晚上再出门', 'Rest first, go out in the evening'],
			},
			{
				t: '18:30',
				what: ['大通公园夜景，札幌电视塔', 'Odori Park lights and the TV Tower'],
				place: 'tvTower',
				note: ['冬夜很冷，待久了就进屋', 'Cold winter night; step inside when it gets too much'],
			},
			{
				t: '19:30',
				what: ['晚餐：薄野拉面（示范）', 'Dinner: Susukino ramen (demo)'],
				place: 'susukino',
				note: ['人多，慢慢走过去', 'Busy; walk over slowly'],
			},
		],
		blocks: [
			{
				type: 'decide',
				icon: 'food',
				tile: ['晚餐', 'Dinner'],
				h: ['第一晚吃什么', 'First night: where to eat'],
				opts: [
					{
						k: 'a',
						mark: 'A',
						name: ['薄野拉面巷（示范）', 'Susukino ramen lane (demo)'],
						cost: ['¥3,000–4,000 / 六人', '¥3,000–4,000 for 6'],
						place: 'susukino',
						when: ['精神还好就去', 'If everyone still has energy'],
						list: [
							['拉面和烤串，边走边吃', 'Ramen and grilled skewers; eat as you walk'],
							['小店多，有座位的先找', 'Many small shops; find seats first'],
							['薄野站步行可到', 'A short walk from Susukino Station'],
						],
					},
					{
						k: 'b',
						mark: 'B',
						name: ['酒店附近简单吃', 'Something simple near the hotel'],
						cost: ['¥2,000–3,000 / 六人', '¥2,000–3,000 for 6'],
						when: ['累了或下大雪', 'Tired or heavy snow'],
					},
				],
			},
			{
				type: 'wear',
				h: ['今天穿', 'What to wear'],
				main: ['厚外套 + 防滑鞋 + 手套', 'Thick coat + grippy boots + gloves'],
				note: ['车站和地铁里很暖，外套要好脱', 'Stations and trains are warm; the coat should come off easily'],
			},
			{
				type: 'budget',
				h: ['第1天花费（估计）', 'Day 1 spend (estimate)'],
				est: true,
				rows: [
					[['JR 快速机场 × 6', 'JR Rapid Airport × 6'], ['≈¥6,400 / 六人', '≈¥6,400 for 6'], 'train'],
					[['交通卡储值', 'Transit card top-up'], ['¥2,000 / 六人', '¥2,000 for 6'], 'card'],
					[['晚餐', 'Dinner'], ['¥3,000–4,000 / 六人', '¥3,000–4,000 for 6'], 'food'],
				],
				total: ['约 ¥11,400–12,400 / 六人', '~¥11,400–12,400 for 6'],
				min: 11400,
				max: 12400,
				note: ['示范价格，现场为准。', 'Demo prices; check on the day.'],
			},
		],
	},
	{
		id: 'd2',
		n: 2,
		date: '2027-02-07',
		dow: ['日', 'Sun'],
		c: 2,
		motif: 'city',
		foodSlots: ['d2-lunch', 'd2-dinner'],
		wish: '慢慢逛',
		gloss: ['', 'Take it slow'],
		mealAt: [
			[/早餐/, [['breakfast', ['bk-hotel']]]],
			[/午餐/, [['lunch', ['d2-lunch']]]],
			[/晚上/, [['dinner', ['d2-dinner']]]],
		],
		route: [
			['hotel', 'otaruStn', 'transit'],
			['otaruStn', 'otaruCanal', 'walking'],
			['otaruCanal', 'sakaimachi', 'walking'],
			['sakaimachi', 'music', 'walking'],
			['music', 'otaruStn', 'walking'],
			['otaruStn', 'hotel', 'transit'],
		],
		title: ['小樽运河 → 堺町通 → 音乐盒堂', 'Otaru Canal → Sakaimachi → Music Box Museum'],
		short: ['小樽一日', 'Otaru day'],
		focus: ['坐火车去小樽，走路为主', 'A train to Otaru, mostly on foot'],
		photos: [],
		wear: ['厚外套 + 帽子 + 防滑鞋', 'Thick coat + hat + grippy boots'],
		budgetChip: ['约 ¥23,900–29,900', '~¥23,900–29,900'],
		schedule: [
			{ t: '08:30', what: ['酒店早餐', 'Breakfast at the hotel'], place: 'hotel', note: ['慢慢吃', 'No rush'] },
			{
				t: '09:30–10:05',
				what: ['JR 去小樽（约35分钟）', 'JR to Otaru (about 35 min)'],
				place: 'otaruStn',
				note: ['从札幌站坐函馆本线', 'From Sapporo Station on the Hakodate Main Line'],
			},
			{
				t: '10:30–12:00',
				what: ['小樽运河散步', 'A walk along Otaru Canal'],
				place: 'otaruCanal',
				todo: true,
				note: ['河边风大，戴帽子', 'Wind off the water; wear a hat'],
			},
			{ t: '12:00–13:15', what: ['午餐：寿司（示范）', 'Lunch: sushi (demo)'], note: ['中午前到，排队会变长', 'Arrive before noon; queues grow'] },
			{
				t: '13:30–14:15',
				what: ['堺町通老街', 'Sakaimachi old street'],
				place: 'sakaimachi',
				note: ['玻璃和木工小店，慢慢逛', 'Glass and woodwork shops; take it slow'],
			},
			{
				t: '14:30–15:30',
				what: ['小樽音乐盒堂', 'Otaru Music Box Museum'],
				place: 'music',
				note: ['室内，有暖气', 'Indoors and warm'],
			},
			{ t: '16:00–16:40', what: ['JR 回札幌', 'JR back to Sapporo'], place: 'sapStn', note: ['车上可以休息', 'Rest on the train'] },
			{ t: '17:00', what: ['回酒店休息', 'Back to the hotel to rest'], place: 'hotel', note: ['晚上的安排在下面选', 'Pick the evening plan below'] },
			{
				t: '18:30',
				what: ['晚上：下面选一个', 'Evening: pick one below'],
				note: ['两个选择都在酒店附近或薄野', 'Both options are near the hotel or in Susukino'],
			},
		],
		blocks: [
			{
				type: 'text',
				icon: 'train',
				tile: ['怎么走', 'Getting there'],
				h: ['今天怎么走', 'Getting around today'],
				p: [['JR 函馆本线往返，车程约35分钟，札幌站出发。', 'JR Hakodate Main Line there and back; about 35 min from Sapporo Station.']],
				total: { amt: '≈¥8,900', per: ['六人往返车费', 'return fares for 6'], min: 8900, max: 8900 },
			},
			{
				type: 'decide',
				icon: 'food',
				tile: ['晚餐', 'Dinner'],
				h: ['晚上吃什么', 'Evening: where to eat'],
				opts: [
					{
						k: 'a',
						mark: 'A',
						name: ['薄野成吉思汗烤羊肉（示范）', 'Susukino lamb grill, Genghis Khan style (demo)'],
						cost: ['¥9,000–12,000 / 六人', '¥9,000–12,000 for 6'],
						place: 'susukino',
						when: ['大家都还有力气', 'If everyone still has energy'],
						list: [
							['烤羊肉配啤酒', 'Grilled lamb with beer'],
							['要排队，先订位', 'Queues on weekends; ask for a table first'],
						],
					},
					{
						k: 'b',
						mark: 'B',
						name: ['酒店附近便利店晚餐', 'Convenience-store dinner near the hotel'],
						cost: ['¥3,000–4,000 / 六人', '¥3,000–4,000 for 6'],
						when: ['累了就选这个', 'Tired? Pick this one'],
					},
				],
			},
			{
				type: 'costs',
				icon: 'food',
				h: ['吃饭', 'Meals'],
				rows: [
					[
						['午餐 寿司', 'Lunch, sushi'],
						['¥6,000–9,000 / 六人', '¥6,000–9,000 for 6'],
					],
					[
						['晚餐', 'Dinner'],
						['¥3,000–12,000 / 六人', '¥3,000–12,000 for 6'],
					],
				],
			},
			{
				type: 'list',
				icon: 'bag',
				h: ['顺路看看', 'On the way'],
				list: [
					['运河边的玻璃工艺店', 'Glass workshops along the canal'],
					['堺町通的木工和文具店', 'Woodwork and stationery shops on Sakaimachi'],
				],
				places: ['otaruCanal', 'sakaimachi'],
			},
			{
				type: 'table',
				icon: 'sun',
				tile: ['天气和穿着', 'Weather & wear'],
				h: ['天气和穿着', 'Weather and clothing'],
				cols: [
					['时段', 'When'],
					['天气', 'Weather'],
					['穿着', 'Wear'],
				],
				rows: [
					[
						['上午', 'Morning'],
						['零下，海风大', 'Below freezing, sea wind'],
						['厚外套、帽子', 'Thick coat, hat'],
					],
					[
						['下午', 'Afternoon'],
						['冷，偶尔有雪', 'Cold, occasional snow'],
						['室内暖，外套可以脱', 'Warm indoors; the coat can come off'],
					],
				],
			},
			{
				type: 'budget',
				h: ['第2天花费（估计）', 'Day 2 spend (estimate)'],
				est: true,
				rows: [
					[['JR 往返 × 6', 'JR return × 6'], ['≈¥8,900 / 六人', '≈¥8,900 for 6'], 'train'],
					[['午餐', 'Lunch'], ['¥6,000–9,000 / 六人', '¥6,000–9,000 for 6'], 'food'],
					[['晚餐', 'Dinner'], ['¥9,000–12,000 / 六人', '¥9,000–12,000 for 6'], 'food'],
				],
				total: ['约 ¥23,900–29,900 / 六人', '~¥23,900–29,900 for 6'],
				min: 23900,
				max: 29900,
			},
			{
				type: 'rain',
				tile: ['下雪方案', 'Snow plan'],
				h: ['下雪的话', 'If it snows hard'],
				list: [
					['音乐盒堂和运河的室内店多待一会儿', 'Stay longer in the indoor shops and the music box museum'],
					['坐计程车回札幌，不走远路', 'Take a taxi back to Sapporo instead of a long walk'],
				],
			},
		],
	},
	{
		id: 'd3',
		n: 3,
		date: '2027-02-08',
		dow: ['一', 'Mon'],
		c: 3,
		motif: 'ski',
		foodSlots: ['d3-lunch'],
		wish: '滑雪去',
		gloss: ['', 'Down the hill'],
		mealAt: [
			[/早餐/, [['breakfast', ['bk-hotel']]]],
			[/午餐/, [['lunch', ['d3-lunch']]]],
		],
		route: [
			['hotel', 'teine', 'driving'],
			['teine', 'hotel', 'driving'],
		],
		tickets: ['teine-lesson'],
		title: ['手稻雪场滑雪课 → 定山渓温泉（两人）', 'Teine ski lesson → Jōzankei Onsen (two of us)'],
		short: ['滑雪 + 温泉', 'Ski + hot spring'],
		focus: ['四人上山，两人去泡温泉', 'Four of us on the hill, two of us in the onsen'],
		photos: [],
		wear: ['雪具 + 防水手套 + 护目镜', 'Ski wear + waterproof gloves + goggles'],
		budgetChip: ['约 ¥43,900–57,900', '~¥43,900–57,900'],
		// the four ski; two take their own plan for the afternoon and rejoin for dinner
		split: {
			icon: 'bus',
			at: '13:45',
			who: ['两人', 'Two of us'],
			h: ['坐巴士去定山渓温泉（示范）', 'Bus to Jōzankei Onsen (demo)'],
			sub: ['天气好才去；傍晚在札幌站集合', 'Only in fair weather; meet at Sapporo Station in the evening'],
			go: [
				{ k: 'go', name: ['晴天，风不大', 'Clear, little wind'] },
				{ k: 'wait', name: ['有风雪：等一小时再决定', 'Snow or wind: wait an hour, then decide'] },
				{ k: 'stop', name: ['大雪封路或累了：回酒店休息', 'Heavy snow or tired: rest at the hotel'] },
			],
			options: [
				{
					id: 'bus',
					name: ['巴士（示范班次）', 'Bus (demo timetable)'],
					default: true,
					leave: '13:50',
					back: '16:30',
					join: '18:00',
					place: 'jozankei',
					fee: ['≈¥2,400 / 两人', '≈¥2,400 for 2'],
					rule: ['16:30 前要上车回札幌', 'Board the bus back by 16:30'],
				},
				{
					id: 'taxi',
					name: ['计程车（约50分钟）', 'Taxi (about 50 min)'],
					leave: '13:50',
					back: '15:30',
					join: '17:30',
					place: 'jozankei',
					fee: ['≈¥20,000 来回 / 两人', '≈¥20,000 return for 2'],
				},
			],
			note: ['示范班次和价格，出发前再查', 'Demo timetable and fares; check before you go'],
		},
		schedule: [
			{ t: '07:30', what: ['酒店早餐', 'Breakfast at the hotel'], place: 'hotel', note: ['吃饱再上山', 'Eat well before the hill'] },
			{
				t: '08:30–09:20',
				what: ['两辆计程车去手稻雪场', 'Two taxis to Sapporo Teine'],
				place: 'teine',
				note: ['约40分钟，雪天会慢', 'About 40 min; slower in snow'],
			},
			{
				t: '09:30',
				what: ['租雪具，集合', 'Gear rental and meet-up'],
				place: 'teine',
				todo: true,
				note: ['租雪具要排队，提早到', 'Gear rental queues; arrive early'],
			},
			{
				t: '10:00–12:00',
				what: ['滑雪课（四人）', 'Ski lesson (four of us)'],
				fixed: true,
				place: 'teine',
				link: 'lesson',
				note: ['准时到，迟到就不能进课', 'On time; late arrivals miss the lesson'],
			},
			{
				t: '12:00–13:30',
				what: ['午餐：雪场食堂（示范）', 'Lunch at the lodge (demo)'],
				note: ['室内暖和，可以烘干手套', 'Warm indoors; dry the gloves here'],
			},
			{
				t: '14:00–15:30',
				what: ['自由滑（四人）', 'Free ski (four of us)'],
				place: 'teine',
				note: ['缓坡为主，累了就停', 'Gentle slopes; stop when tired'],
			},
			{ t: '16:00', what: ['回酒店休息', 'Back at the hotel to rest'], place: 'hotel', note: ['泡澡，暖身', 'A hot shower to warm up'] },
			{
				t: '17:30',
				what: ['札幌站集合', 'Meet at Sapporo Station'],
				place: 'sapStn',
				note: ['两人从定山渓回来也在这里', 'The two from Jōzankei meet here too'],
			},
			{
				t: '18:00',
				what: ['一起吃晚餐，大通附近', 'Dinner together near Odori'],
				place: 'odori',
				note: ['这顿饭大家都到齐', 'Everyone is back for this one'],
			},
		],
		blocks: [
			{
				type: 'weather',
				icon: 'cloud',
				h: ['下雪还去吗', 'Snow: still go?'],
				flow: true,
				opts: [
					{
						k: 'go',
						name: ['小雪照去', 'Light snow: go'],
						list: [
							['雪道照常，雪具防水就行', 'Runs stay open; waterproof gear is enough'],
							['缆车和雪场室内都可以待', 'Lifts and the lodge indoors'],
						],
					},
					{
						k: 'wait',
						name: ['大风雪：等一小时再决定', 'Heavy snow: wait an hour, then decide'],
						list: [
							['先在食堂待着', 'Wait in the lodge first'],
							['课程可以改到第4天下午', 'The lesson can move to the afternoon of Day 4'],
						],
						body: ['缆车停了就不上山。', 'If the lifts stop, we do not go up.'],
					},
					{
						k: 'stop',
						name: ['封路：和第4天对调', 'Roads closed: swap with Day 4'],
						list: [['第4天室内行程：白色恋人公园、狸小路', 'Day 4 is indoors: Shiroi Koibito Park, Tanukikoji']],
					},
				],
			},
			{
				type: 'text',
				icon: 'info',
				h: ['去雪场', 'To the ski area'],
				p: [['计程车最方便，六人分两辆。', 'Taxis are easiest; six of us in two cars.']],
				total: { amt: '≈¥10,000–14,000', per: ['两辆车来回', 'two cars, return'], min: 10000, max: 14000 },
			},
			{
				type: 'wear',
				h: ['今天穿', 'What to wear'],
				main: ['雪具 + 防水手套 + 护目镜', 'Ski wear + waterproof gloves + goggles'],
				note: ['山上比市区冷很多', 'Much colder on the hill than in the city'],
			},
			{
				type: 'budget',
				h: ['第3天花费（估计）', 'Day 3 spend (estimate)'],
				est: true,
				rows: [
					[['两辆计程车', 'Two taxis'], ['¥10,000–14,000 / 六人', '¥10,000–14,000 for 6'], 'car'],
					[['滑雪课（四人）', 'Ski lesson (four of us)'], ['¥19,500–25,500 / 四人', '¥19,500–25,500 for 4'], 'ticket'],
					[['温泉巴士（两人）', 'Bus to the onsen (two of us)'], ['≈¥2,400 / 两人', '≈¥2,400 for 2'], 'train'],
					[['午餐 + 晚餐', 'Lunch + dinner'], ['¥12,000–16,000 / 六人', '¥12,000–16,000 for 6'], 'food'],
				],
				total: ['约 ¥43,900–57,900', '~¥43,900–57,900'],
				min: 43900,
				max: 57900,
				note: ['课程按人算，两人去温泉时不算在课费里。', 'The lesson is charged per person; the two at the onsen are not in it.'],
			},
			{
				type: 'rain',
				tile: ['下雪方案', 'Snow plan'],
				h: ['下雪大的话', 'If the snow is heavy'],
				groups: [
					{
						h: ['雪场内', 'On the hill'],
						list: [
							['食堂里等', 'Wait in the lodge'],
							['课程改时间', 'Move the lesson'],
						],
					},
					{
						h: ['城里', 'In the city'],
						list: [
							['白色恋人公园和狸小路', 'Shiroi Koibito Park and Tanukikoji'],
							['温泉也可以改到晚上', 'The onsen can move to the evening'],
						],
					},
				],
			},
		],
	},
	{
		id: 'd4',
		n: 4,
		date: '2027-02-09',
		dow: ['二', 'Tue'],
		c: 4,
		motif: 'food',
		foodSlots: ['bk-nijo', 'd4-lunch', 'd4-dinner'],
		freeEvening: true,
		wish: '吃遍',
		gloss: ['', 'Eat our way round'],
		mealAt: [
			[/早餐/, [['breakfast', ['bk-nijo']]]],
			[/午餐/, [['lunch', ['d4-lunch']]]],
			[/晚餐/, [['dinner', ['d4-dinner']]]],
		],
		route: [
			['hotel', 'nijo', 'walking'],
			['nijo', 'shiroi', 'transit'],
			['shiroi', 'tanuki', 'transit'],
			['tanuki', 'hotel', 'walking'],
			['hotel', 'susukino', 'transit'],
		],
		title: ['二条市场 → 白色恋人公园 → 狸小路 → 汤咖喱', 'Nijo Market → Shiroi Koibito Park → Tanukikoji → soup curry'],
		short: ['市场和购物', 'Markets & shops'],
		focus: ['吃和逛，室内为主', 'Eat and browse, mostly indoors'],
		photos: [],
		wear: ['厚外套 + 防滑鞋', 'Thick coat + grippy boots'],
		budgetChip: ['约 ¥21,000–28,000', '~¥21,000–28,000'],
		schedule: [
			{
				t: '08:30',
				what: ['二条市场早餐', 'Breakfast at Nijo Market'],
				place: 'nijo',
				note: ['海鲜丼，早上人少', 'Seafood bowls; fewer people in the morning'],
			},
			{
				t: '10:00–11:30',
				what: ['白色恋人公园', 'Shiroi Koibito Park'],
				place: 'shiroi',
				note: ['室内展示，下雪也可以', 'Indoor displays; fine in snow'],
			},
			{
				t: '12:00–13:30',
				what: ['午餐：味噌拉面（示范）', 'Lunch: miso ramen (demo)'],
				todo: true,
				note: ['店小，早点去', 'A small shop; go early'],
			},
			{
				t: '14:00–16:30',
				what: ['狸小路购物（免税）', 'Tanukikoji shopping (tax-free)'],
				place: 'tanuki',
				shops: true, // the trip's shop list (shops.json) goes under this stop
				todo: true,
				note: ['同一家店买满 ¥5,000（税前）才能退税', 'Spend ¥5,000+ before tax in one shop for a refund'],
			},
			{ t: '17:00', what: ['回酒店休息', 'Back at the hotel to rest'], place: 'hotel', note: ['晚上要出门，先休息', 'Rest before going out'] },
			{
				t: '19:00',
				what: ['薄野汤咖喱晚餐（示范）', 'Soup curry dinner in Susukino (demo)'],
				place: 'susukino',
				note: ['汤咖喱辣度可以选', 'Pick your spice level'],
			},
		],
		blocks: [
			{
				type: 'text',
				icon: 'train',
				tile: ['怎么走', 'Getting there'],
				h: ['今天怎么走', 'Getting around today'],
				p: [['地铁南北线和步行，狸小路在大通站附近。', 'Subway Namboku line and walking; Tanukikoji is near Odori Station.']],
				total: { amt: '≈¥2,500', per: ['六人当天交通', 'transport for 6, all day'], min: 2500, max: 2500 },
			},
			{
				type: 'costs',
				icon: 'food',
				h: ['吃饭', 'Meals'],
				rows: [
					[
						['早餐 + 午餐', 'Breakfast + lunch'],
						['¥11,000–14,000 / 六人', '¥11,000–14,000 for 6'],
					],
					[
						['晚餐 汤咖喱', 'Dinner, soup curry'],
						['¥9,000–12,000 / 六人', '¥9,000–12,000 for 6'],
					],
				],
			},
			{
				type: 'list',
				icon: 'bag',
				h: ['免税小提醒', 'Tax-free tips'],
				list: [
					['买完留好收据和包装', 'Keep receipts and packaging'],
					['同一家店，同一天，满 ¥5,000（税前）', 'One shop, one day, ¥5,000+ before tax'],
				],
				places: ['tanuki'],
			},
			{
				type: 'wear',
				h: ['今天穿', 'What to wear'],
				main: ['厚外套 + 防滑鞋', 'Thick coat + grippy boots'],
				note: ['室外排队时很冷', 'Queues outside are cold'],
			},
			{
				type: 'budget',
				h: ['第4天花费（估计）', 'Day 4 spend (estimate)'],
				est: true,
				rows: [
					[['早餐 + 午餐', 'Breakfast + lunch'], ['¥11,000–14,000 / 六人', '¥11,000–14,000 for 6'], 'food'],
					[['晚餐', 'Dinner'], ['¥9,000–12,000 / 六人', '¥9,000–12,000 for 6'], 'food'],
					[['门票与交通', 'Tickets and transport'], ['¥1,000–2,000 / 六人', '¥1,000–2,000 for 6'], 'ticket'],
				],
				total: ['约 ¥21,000–28,000 / 六人', '~¥21,000–28,000 for 6'],
				min: 21000,
				max: 28000,
			},
			{
				type: 'rain',
				tile: ['下雪方案', 'Snow plan'],
				h: ['下雪的话', 'If it snows hard'],
				list: [
					['狸小路有拱廊，雪天也能逛', 'Tanukikoji has an arcade; good in snow'],
					['晚餐改去酒店附近', 'Move dinner to near the hotel'],
				],
			},
		],
	},
	{
		id: 'd5',
		n: 5,
		date: '2027-02-10',
		dow: ['三', 'Wed'],
		c: 5,
		motif: 'zoo',
		foodSlots: ['bk-hotel'],
		freeEvening: true,
		wish: '看企鹅',
		gloss: ['', 'Penguins'],
		mealAt: [[/早餐/, [['breakfast', ['bk-hotel']]]]],
		// a long drive each way: the page lists the rest stops on the way (drive-stops.json), for reference only
		route: [
			['hotel', 'zoo', 'driving'],
			['zoo', 'hotel', 'driving'],
		],
		title: ['开车去旭山动物园，当天来回', 'A day drive to Asahiyama Zoo and back'],
		short: ['旭山动物园', 'Asahiyama Zoo'],
		focus: ['单程开车约两小时，雪天多留时间', 'About two hours each way by car; allow more in snow'],
		photos: [],
		wear: ['厚外套 + 防滑鞋 + 帽子', 'Thick coat + grippy boots + a hat'],
		budgetChip: ['约 ¥39,600–47,600', '~¥39,600–47,600'],
		schedule: [
			{ t: '07:30', what: ['酒店早餐', 'Breakfast at the hotel'], place: 'hotel', note: ['早点吃，八点半出发', 'Eat early; we leave at 08:30'] },
			{
				t: '08:30',
				icon: 'car',
				what: ['取车，开车去旭川', 'Pick up the car and drive to Asahikawa'],
				place: 'hotel',
				note: ['走道央自动车道，约两小时；累了就在服务区停', 'The Dō-Ō Expressway, about two hours; stop at a service area if anyone needs a break'],
			},
			{
				t: '~10:45–13:30',
				what: ['旭山动物园：企鹅散步（示范时间）', 'Asahiyama Zoo: the penguin walk (demo times)'],
				place: 'zoo',
				note: ['企鹅散步只在冬天，时间以园方公告为准', 'The penguin walk runs in winter only; check the zoo’s own times'],
			},
			{ t: '13:30–14:15', what: ['午餐：园内餐厅（示范）', 'Lunch at the zoo café (demo)'] },
			{
				t: '14:30',
				icon: 'car',
				what: ['开车回札幌', 'Drive back to Sapporo'],
				place: 'zoo',
				note: ['天黑得早，四点半以后路更滑', 'It gets dark early; the roads are icier after 16:30'],
			},
			{ t: '~17:00', what: ['回到酒店，还车', 'Back at the hotel; return the car'], place: 'hotel', note: ['晚上自由活动', 'A free evening'] },
		],
		blocks: [
			{
				type: 'text',
				icon: 'car',
				tile: ['怎么走', 'Getting there'],
				h: ['今天怎么走', 'Getting there today'],
				p: [
					[
						'七人座租车，一位司机开去、一位开回。冬天路滑，比地图的时间多留一倍。',
						'A seven-seat rental car, one driver each way. Winter roads are slippery: allow twice the map’s time.',
					],
				],
			},
			{
				type: 'budget',
				h: ['第5天花费（估计）', 'Day 5 spend (estimate)'],
				rows: [
					[['租车一天（示范价）', 'Car hire, one day (demo price)'], ['≈¥18,000–22,000 / 六人', '≈¥18,000–22,000 for 6'], 'car'],
					[['高速费和油费', 'Tolls and fuel'], ['≈¥9,000–11,000 / 六人', '≈¥9,000–11,000 for 6'], 'car'],
					[['动物园门票', 'Zoo tickets'], ['¥6,600 / 六人', '¥6,600 for 6'], 'ticket'],
					[['午餐', 'Lunch'], ['¥6,000–8,000 / 六人', '¥6,000–8,000 for 6'], 'food'],
				],
				total: ['约 ¥39,600–47,600 / 六人', '~¥39,600–47,600 for 6'],
				min: 39600,
				max: 47600,
			},
		],
	},
	{
		id: 'd6',
		n: 6,
		date: '2027-02-11',
		dow: ['四', 'Thu'],
		c: 6,
		motif: 'plane',
		foodSlots: ['bk-hotel'],
		wish: '回家',
		gloss: ['', 'Home'],
		mealAt: [[/早餐/, [['breakfast', ['bk-hotel']]]]],
		route: [
			['hotel', 'odori', 'walking'],
			['odori', 'hotel', 'walking'],
			['hotel', 'cts', 'driving'],
		],
		tickets: ['airport-van'],
		title: ['退房 → 大通公园散步 → 机场 → 回家', 'Check out → Odori Park walk → airport → home'],
		short: ['回家', 'Home'],
		focus: ['行李寄放，最后散步，然后去机场', 'Bags stay at the hotel, a last walk, then the airport'],
		photos: [],
		wear: ['厚外套 + 好走的鞋', 'Thick coat + walking shoes'],
		budgetChip: ['约 ¥21,500–25,500', '~¥21,500–25,500'],
		schedule: [
			{ t: '08:30', what: ['酒店早餐', 'Breakfast at the hotel'], place: 'hotel', note: ['慢慢吃，别赶', 'No rush'] },
			{
				t: '09:00',
				what: ['退房，行李寄放在酒店', 'Check out; bags stay in the hotel luggage room'],
				place: 'hotel',
				note: ['寄放到出发前', 'Bags stay until we leave'],
			},
			{
				t: '09:30–10:10',
				what: ['大通公园最后散步', 'A last walk in Odori Park'],
				place: 'odori',
				note: ['下雪天就在酒店大堂等', 'In snow, wait in the hotel lobby instead'],
			},
			{ t: '10:20', what: ['回酒店取行李', 'Back at the hotel for the bags'], place: 'hotel', note: ['约20分钟', 'About 20 min'] },
			{
				t: '~10:50',
				rel: { dep: [-170], about: 1 },
				what: ['出发去机场', 'Leave for the airport'],
				fixed: true,
				place: 'hotel',
				note: ['两台计程车，或 JR 加步行', 'Two taxis, or JR plus a walk'],
			},
			{
				t: '~11:30–11:55',
				rel: { dep: [-130, -105], about: 1 },
				what: ['到机场，退税柜台', 'At the airport: tax-free counter'],
				place: 'cts',
				todo: true,
				note: ['退税要在托运行李之前', 'Tax refund comes before bag check-in'],
			},
			{
				t: '~12:00',
				rel: { dep: [-100], about: 1 },
				what: ['托运行李，安检与出境', 'Bags checked, security and immigration'],
				place: 'cts',
				todo: true,
				note: ['托运柜台起飞前60分钟关', 'Bag counters close 60 min before take-off'],
			},
			{
				t: '13:40',
				rel: { dep: [0] },
				what: ['航班起飞', 'Flight departs'],
				fixed: true,
				place: 'cts',
				note: ['登机前约40分钟到登机口', 'At the gate about 40 min before boarding'],
			},
		],
		blocks: [
			{
				type: 'text',
				icon: 'plane',
				h: ['去机场', 'To the airport'],
				p: [['两台计程车最省力，JR 加步行最省钱。', 'Two taxis are easiest; JR plus a walk is cheapest.']],
			},
			{
				type: 'checklist',
				id: 'lastday',
				icon: 'list',
				h: ['离开前', 'Before leaving'],
				items: [
					['护照都在身上吗？', 'Everyone has a passport?'],
					['退税单和商品都在行李里吗？', 'Tax-free forms and purchases packed?'],
				],
			},
			{
				type: 'wear',
				h: ['今天穿', 'What to wear'],
				main: ['厚外套 + 好走的鞋', 'Thick coat + walking shoes'],
				note: ['飞机上冷气强，带一件轻外套', 'Strong AC on the plane; bring a light layer'],
			},
			{
				type: 'budget',
				h: ['第6天花费（估计）', 'Day 6 spend (estimate)'],
				rows: [
					[['计程车去机场', 'Taxis to the airport'], ['≈¥18,500–21,500 / 六人', '≈¥18,500–21,500 for 6'], 'car'],
					[['早餐', 'Breakfast'], ['¥3,000–4,000 / 六人', '¥3,000–4,000 for 6'], 'food'],
				],
				total: ['约 ¥21,500–25,500 / 六人', '~¥21,500–25,500 for 6'],
				min: 21500,
				max: 25500,
			},
		],
	},
];

const OPTIONAL = [
	{
		id: 'opt-moiwa',
		place: 'moiwa',
		name: ['藻岩山缆车', 'Mount Moiwa Ropeway'],
		short: ['藻岩山', 'Mount Moiwa'],
		near: [{ day: 'd1', place: 'tvTower' }], // a chip under that day's stop; tapping it opens this card
		meta: ['不排进行程', 'Not scheduled'],
		when: ['天气好的傍晚', 'A clear evening'],
		list: [
			['晴天的夜景最好', 'Best on a clear night'],
			['缆车口排队约20分钟', 'Queue at the ropeway about 20 min'],
			['冷，缆车里也要穿厚外套', 'Cold; keep the thick coat on in the cabin'],
		],
		cost: ['缆车 **≈¥10,000** / 六人', 'Ropeway **≈¥10,000** for 6'],
		note: ['第1天晚上或第6天上午都可以。', 'Fits the Day 1 evening, or a clear morning on Day 6.'],
	},
];

const BUDGET = {
	// what's truly outside the plan; flights and the hotel are rows now, paid (ADR-20261128-budget-paid-insurance)
	excludes: [['购物', 'Shopping']],
	rows: [
		// paid at home, in the home currency: exact amounts, with where and when (synthetic booking numbers)
		{
			label: ['机票（来回）', 'Flights, return'],
			cat: 'transport', // the budget's kinds (By kind): transport, car, lodging, food, tickets, activity, insurance, other
			min: 16800,
			max: 16800,
			cur: 'home',
			paid: '2026-11-03',
			via: ['航空公司 App', 'Airline app'],
			ref: 'DEMO-H6P4',
		},
		{
			label: ['酒店（五晚）', 'Hotel, five nights'],
			cat: 'lodging',
			min: 7200,
			max: 7200,
			cur: 'home',
			paid: '2026-12-14',
			via: ['订房网站', 'Booking site'],
			ref: 'DEMO-40917',
		},
		// paid in parts: a deposit in the activities app, the rest on the day
		{
			label: ['滑雪课（四人）', 'Ski lesson (four of us)'],
			cat: 'activity',
			parts: [
				{ amt: 7800, paid: '2026-12-08', via: ['活动平台', 'Activities app'], label: ['订金', 'Deposit'] },
				{ amt: 11700, via: ['当天付现金', 'Cash on the day'], label: ['尾款', 'Balance'] },
			],
		},
		// still to come: estimates in the trip's currency
		[['机场来回', 'Airport, both ways'], '≈¥26,000–30,000', 26000, 30000, 'airport', 'transport'],
		[['雪场缆车', 'Lift passes'], '≈¥4,000–6,000', 4000, 6000, 'activity'],
		[['租车一天、高速和油费', 'Car hire for a day, tolls and fuel'], '≈¥27,000–33,000', 27000, 33000, 'car'],
		[['市内交通', 'Local transport'], '≈¥6,000–9,000', 6000, 9000, 'transport'],
		[['门票与活动', 'Tickets and activities'], '≈¥4,000–6,000', 4000, 6000, 'tickets'],
		[['吃饭（含早餐）', 'Meals (with breakfasts)'], '≈¥50,000–66,000', 50000, 66000, 'food'],
		// planned, price not known yet: listed, never counted
		{ label: ['加购行李（回程）', 'Extra baggage, home'], tbd: true, via: ['航空公司 App', 'Airline app'], cat: 'transport' },
	],
	split: ['滑雪课按人算，两人去温泉时不付课费。', 'The lesson is charged per person; the two at the onsen do not pay it.'],
	suggest: ['公费 ¥150,000，最后多退少补。', 'A shared pot of ¥150,000; settle up at the end.'],
	pool: 150000,
	poolText: ['公费 ¥150,000', 'Shared pot ¥150,000'],
	airportNote: ['JR 快速机场 + 车比整段包车接送省约 ¥10,000–14,000', 'JR Rapid Airport plus a taxi saves about ¥10,000–14,000 against a jumbo taxi'],
	chartNote: ['虚线框 = 估算。不含购物。', 'Dashed = estimate. Excludes shopping.'],
};

const MONEY = {
	cash: {
		amt: '≈¥30,000–40,000',
		uses: [
			['拉面、小吃和市场', 'Ramen, snacks and markets'],
			['计程车和小店', 'Taxis and small shops'],
		],
	},
	card: [['百货和药妆店大多可以刷卡', 'Department stores and drugstores mostly take cards']],
	transitCard: ['每人先储值 **¥2,000**，不够再加。', 'Top up **¥2,000** each to start; add more when low.'],
};

const WEATHER = {
	sites: ['jma'], // SITES keys linked under the forecast
	lede: ['二月札幌零下，雪天多，市区很干燥。', 'February in Sapporo: below freezing, plenty of snow, dry air in town.'],
	when: [
		{ d: '2027-01-30', t: ['出发前一周', 'A week before'], v: ['看长期预报', 'Check the long-range forecast'] },
		{ t: ['每天早上', 'Every morning'], v: ['看当天预报和道路情况', 'Check the day’s forecast and road conditions'] },
	],
	items: [
		['防滑冰爪', 'Ice grips'],
		['保暖手套（两副）', 'Warm gloves (two pairs)'],
	],
	outfits: [
		{
			h: ['市区', 'City'],
			main: ['厚外套 + 防滑鞋', 'Thick coat + grippy boots'],
			note: ['室内暖气强，内层穿薄。', 'Indoors is warm; dress in layers.'],
			day: 'd2',
		},
		{
			h: ['雪场', 'Ski'],
			main: ['雪具 + 防水手套', 'Ski wear + waterproof gloves'],
			note: ['山上风大，带护目镜。', 'Wind on the hill; bring goggles.'],
			day: 'd3',
		},
	],
};

const TAX = {
	h: ['外国旅客免税', 'Tourist tax-free'],
	list: [
		['同一天同一家店买满 ¥5,000（税前）', 'Spend ¥5,000+ before tax in one shop on one day'],
		['找免税标志的店', 'Look for the tax-free sign'],
		['出境前在海关柜台办，托运行李之前', 'Claim at the customs counter before bag check-in'],
	],
	shops: ['百货和药妆店大多可以退税。', 'Most department stores and drugstores offer it.'],
	note: ['示范规则，出发前再查。', 'Demo rules; check before you go.'],
};

const FLIGHTS = {
	out: {
		no: 'XX 801',
		dep: '09:10',
		arr: '15:00',
		date: '2027-02-06',
		from: ['香港', 'Hong Kong'],
		to: ['新千岁', 'New Chitose'],
		dur: '4h 50m',
	},
	ret: {
		no: 'XX 802',
		dep: '13:40',
		arr: '17:30',
		date: '2027-02-11',
		from: ['新千岁', 'New Chitose'],
		to: ['香港', 'Hong Kong'],
		dur: '4h 50m',
		// the going-home morning, in minutes before take-off: back at the hotel for the bags, leave, at the airport;
		// latest = the last sensible arrival at the airport, road = the longest drive there
		plan: {
			back: 200,
			leave: 170,
			airport: 130,
			latest: 110,
			road: 60,
			route: [
				'新千岁 → 香港。登机时间在值机后的登机证上（通常起飞前约40分钟）。',
				'New Chitose → Hong Kong. Boarding time is on the boarding pass after check-in (usually ~40 min before).',
			],
			// `at`: "HH:MM" or minutes before take-off; {latest} = the latest time to leave, {-N} = N minutes before take-off
			steps: [
				{ at: ['09:00', 280], what: ['退房，行李寄放在酒店', 'Check out; bags stay in the hotel luggage room'] },
				{ at: ['09:30', 250], what: ['大通公园散步（行李在酒店）', 'A walk in Odori Park (bags stay at the hotel)'] },
				{ by: true, at: [200], what: ['回酒店取行李（约20分钟）', 'Back at the hotel for the bags (~20 min)'] },
				{
					at: [170, 160],
					what: ['出发去机场（最晚约{latest}）：计程车约60分钟', 'Leave for the airport (latest ~{latest}): taxi ~60 min'],
				},
				{
					at: [130, 120],
					what: [
						'到机场：柜台约起飞前3小时开（约{-180}），早到排前面',
						'At the airport: counters open ~3 h before (~{-180}); early means near the front of the queue',
					],
				},
				{
					at: [100],
					what: ['退税：在海关柜台办，托运行李之前', 'Tax refund at the customs counter, before bag check-in'],
				},
				{
					by: true,
					at: [60],
					what: [
						'托运完行李（柜台起飞前60分钟关）；安检＋出境约30–45分钟',
						'Bags checked (counters close 60 min before); security + immigration ~30–45 min',
					],
				},
			],
		},
	},
};

const CHECKLIST = [
	{
		id: 'bookings',
		h: ['预订', 'Bookings'],
		// group sync: one person books, everyone sees it ticked (only when the page is built with --sync)
		shared: true,
		items: [
			{ id: 'hotel', t: ['酒店已订（示范）', 'Hotel booked (demo)'], sub: ['4晚，六人', 'Four nights, six people'] },
			{ id: 'lesson', t: ['滑雪课已预约（示范）', 'Ski lesson booked (demo)'], sub: ['四人', 'Four of us'], site: 'lesson' },
		],
	},
	{
		id: 'mine',
		h: ['个人', 'Each of us'],
		items: [
			{ id: 'passport', t: ['护照有效期6个月以上', 'Passports valid 6+ months'] },
			{ id: 'layers', t: ['保暖内衣和厚袜子', 'Thermal layers and thick socks'] },
			{ id: 'grips', t: ['防滑冰爪放进随身包', 'Ice grips in the carry-on'], sub: ['走路容易滑', 'Pavements get icy'] },
		],
	},
];

const PRIORITIES = {
	must: [
		['走得慢的两人也舒服', 'Both of us who walk slowly stay comfortable'],
		['滑雪课准时到', 'On time for the ski lesson'],
	],
	should: [['泡一次温泉', 'One hot spring soak']],
	mood: [['慢慢走，多休息', 'Walk slowly, rest often']],
};

const PRINCIPLE = {
	wish: '慢慢走',
	p: [
		['每天最多三个地方', 'At most three places a day'],
		['走得慢的人累了就回酒店', 'When someone tires, back to the hotel'],
		['固定时间不能迟到', 'Fixed times are never late'],
	],
};

const AIRPORT = {
	// the airport's terminals: place ids + codes; the first is where the party lands and leaves
	terminals: [{ place: 'cts', code: 'NCTS' }],
	sites: ['jr'], // SITES keys linked under the arrival steps
	departSites: [{ site: 'demoTaxi', label: ['示范车行', 'Demo taxi company'] }], // … and under the going-home links
	routeTitle: ['搭 JR 快速机场到札幌站', 'Taking the JR Rapid Airport'], // the heading over the route diagram (`route`)
	routeAlt: ['新千岁机场到札幌站：铁路路线', 'New Chitose to Sapporo by rail'], // the diagram's accessible title
	transitCardSite: 'sapica', // SITES key for the transit card (its name comes from the region pack)
	transitCardTicket: 'ic-buy', // extra.json ticket card: buying one
	lede: ['落地后多数人坐 JR 快速机场，行李多就加一辆车。', 'Most of us take the JR Rapid Airport after landing; lots of bags means a car.'],
	facts: [
		{ k: ['JR 快速机场票价', 'JR Rapid Airport fare'], v: ['≈¥1,070 / 人', '≈¥1,070 each'] },
		{ k: ['车程', 'Ride time'], v: ['约37分钟', '~37 min'] },
	],
	methods: [
		{
			id: 'jr',
			pick: true,
			icon: 'train',
			short: ['JR + 车', 'JR + taxi'],
			name: ['JR 快速机场 + 计程车（行李）', 'JR Rapid Airport + taxi for the bags'],
			sub: ['推荐', 'Recommended'],
			min: 7900,
			max: 8400,
			cost: '≈¥7,900–8,400',
			per: ['每人约 ¥1,300–1,400 / 人', 'about ¥1,300–1,400 each'],
			time: ['约60分钟', '~60 min'],
			xfer: ['札幌站换计程车', 'Taxi from Sapporo Station'],
			bags: ['行李坐车', 'Bags go by taxi'],
			list: [['走得慢的两人和行李坐车', 'The two of us who walk slowly, and bags, go by taxi']],
			when: ['行李多', 'Lots of bags'],
		},
		{
			id: 'jumbo',
			icon: 'car',
			short: ['大车', 'Jumbo'],
			name: ['大型计程车直达酒店', 'Jumbo taxi straight to the hotel'],
			sub: ['最省力', 'Least effort'],
			min: 18500,
			max: 21500,
			cost: '≈¥18,500–21,500',
			per: ['每人约 ¥3,100–3,600 / 人', 'about ¥3,100–3,600 each'],
			time: ['约60分钟', '~60 min'],
			xfer: ['门到门', 'Door to door'],
			bags: ['司机帮搬', 'Driver helps'],
			list: [
				['六人一辆，要求大车', 'Six in one car: ask for a jumbo'],
				['高峰期会慢', 'Slower at peak times'],
			],
			when: ['行李很多', 'Very heavy bags'],
		},
		{
			id: 'van',
			ticket: 'airport-van', // extra.json ticket card shown with this way
			icon: 'van',
			short: ['接送车', 'Van'],
			name: ['预约机场接送车（示范）', 'Pre-booked airport van (demo)'],
			sub: ['最稳', 'Most predictable'],
			min: 16500,
			max: 19500,
			cost: '≈¥16,500–19,500',
			per: ['每人约 ¥2,750–3,250 / 人', 'about ¥2,750–3,250 each'],
			time: ['约60分钟', '~60 min'],
			xfer: ['门到门', 'Door to door'],
			bags: ['司机帮搬', 'Driver helps'],
			list: [['要提前预约', 'Book ahead']],
			when: ['航班晚，或天气差', 'Late flight, or bad weather'],
		},
	],
	rule: [
		{
			k: 'go',
			name: ['准时落地：JR 快速机场', 'On time: JR Rapid Airport'],
			list: [['领完行李就去 JR 站', 'Straight to the JR station after bags']],
		},
		{ k: 'wait', name: ['晚到：看情况', 'Late: decide on the spot'], list: [['晚上8点后落地叫车', 'Landing after 20:00: take a taxi']] },
		{
			k: 'stop',
			name: ['很晚或大雪：接送车', 'Very late or heavy snow: the van'],
			list: [['晚上10点后落地，或大雪封路，用接送车', 'Landing after 22:00, or roads closed by snow: use the van']],
			body: ['提前一天确认。', 'Confirm a day ahead.'],
		},
	],
	steps: [
		['跟着 JR 的指示牌走到快速机场站', 'Follow the JR signs to the Rapid Airport station'],
		['买票或用交通卡进站，坐到札幌站', 'Buy a ticket or tap a transit card, ride to Sapporo Station'],
		['札幌站出站，计程车去酒店', 'Leave Sapporo Station and take a taxi to the hotel'],
	],
	transitCard: [
		['JR 车站或售票机可以买', 'Buy at the JR station or a ticket machine'],
		['Suica 在 JR 和地铁都能用', 'Suica works on JR and the subway'],
	],
	route: [
		{ code: 'JR', name: ['新千岁机场站', 'New Chitose Airport Station'], line: 'airport' },
		{ seg: ['快速机场 · 约37分钟 · ≈¥1,070', 'Rapid Airport · ~37 min · ≈¥1,070'], line: 'airport' },
		{ code: '札幌', name: ['札幌站', 'Sapporo Station'], line: 'airport', fork: true },
	],
	depart: {
		lede: ['回程：最后一天上午从酒店出发。', 'Going home: leave the hotel on the morning of the last day.'],
		list: [
			['提前3小时到机场', 'At the airport 3 hours early'],
			['退税在托运行李之前办', 'Tax refund before bag check-in'],
		],
	},
	sourceNote: [
		'示范资料：票价为约数，出发前请查 JR 北海道官网。',
		'Demo information; fares are approximate, check the JR Hokkaido site before you go.',
	],
};

const ENTRY = {
	sites: ['vjw'], // SITES keys linked at the end of the section
	sources: ['出入国在留管理厅、外务省、国税厅官网', 'Immigration Services Agency, MOFA and the National Tax Agency sites'],
	rules: [
		{
			h: ['入境前', 'Before you land'],
			p: [
				'示范：先查护照的免签规定，再在 Visit Japan Web 登记。',
				'Demo: check the visa rules for your passport first, then register on Visit Japan Web.',
			],
			site: 'vjw',
		},
	],
};

const ENTRY_CHECKS = {
	id: 'entry',
	h: ['入境准备', 'Entry prep'],
	items: [
		{ id: 'entry-vjw', t: ['Visit Japan Web 登记', 'Visit Japan Web registration'], due: '2027-02-01', site: 'vjw' },
		{ id: 'entry-tax', t: ['护照和退税单放在随身包', 'Passport and tax-free forms in the carry-on'], due: '2027-02-05', sub: ['示范', 'Demo'] },
	],
};
