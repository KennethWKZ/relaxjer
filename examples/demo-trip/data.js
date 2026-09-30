/* Demo trip: a fictional group of five, one week in Taipei (Sat 13 – Fri 19 Mar 2027).
   Synthetic and safe to publish. Hotel, flights, shops, food stalls and prices are invented; landmarks are public places.
   Nothing here is copied from Google. Costs for the whole group are written "NT$a–b / 五人" and "NT$a–b for 5"
   (the currency symbol and group size come from TRIP) so the page adds the per-person share. */

const TRIP = {
	name: ['台北示范行', 'Taipei demo trip'],
	start: '2027-03-13',
	end: '2027-03-19',
	brand: '台北示范行', // brush lettering, page title, home-screen name
	description: '示范：五人台北一周 3/13–3/19 · Demo: a week in Taipei for 5, 13–19 Mar 2027',
	pax: 5, // group size: every "for 5" figure also shows a share each
	tz: 'Asia/Taipei', // the destination's clock, whatever the phone says
	// the destination pack: destinations/tw (tax refund, lucky draw) + regions/taipei (metro, taxi meter, bike share)
	destination: 'tw',
	region: 'taipei',
	currency: { sym: 'NT$', home: 'RM', rate: 7.8, rateNote: ['示范汇率，出发前改成当天汇率', 'Demo rate; update before the trip'] },
	checked: '2027-03-01', // when hours and prices were last checked
	arriveCity: ['桃园', 'Taoyuan'],
	forecastSpot: 'taipei', // which forecast.json spot a day reads unless it names its own
	searchHint: ['搜索：温泉、下雨、NT$、野柳…', 'Search: hot spring, rain, NT$, Yehliu…'],
	footer: ['示范行程：地点是真实的，旅店、航班、价格都是虚构的。', 'Demo trip: the places are real; the hotel, flights and prices are made up.'],
	mapViews: [
		// map area buttons; the map opens on the first
		{ id: 'city', name: ['台北市区', 'Taipei city'], bbox: [121.49, 25.02, 121.6, 25.1] },
		{ id: 'beitou', name: ['北投', 'Beitou'], bbox: [121.49, 25.12, 121.53, 25.15] },
		{ id: 'coast', name: ['北海岸', 'North coast'], bbox: [121.66, 25.1, 121.78, 25.22] },
		{ id: 'airport', name: ['机场', 'Airport'], bbox: [121.2, 25.03, 121.56, 25.1] },
	],
	shopDays: [
		// {dN} = that day's date, {back} = the time to collect the bags on the last day
		{
			ok: true,
			zh: '<b>{d6} 今天</b>：买完先拿回酒店寄放，{back} 回酒店一起拿',
			en: '<b>{d6} today</b>: leave purchases at the hotel, collect them all at {back}',
		},
		{
			ok: false,
			zh: '<b>不建议大采购</b>：{d2}（一直走路）、{d3}（泡温泉）；{d1}刚落地带行李',
			en: '<b>Not for big shopping</b>: {d2} (on foot all day), {d3} (hot springs); {d1} arriving with suitcases',
		},
	],
	kml: { optional: '备选 Optional', transport: ['hotel', 'tpe1', 'tpe2', 'a1', 'tpmain'] },
	addStopNote: [
		'第6天 13:00–17:00 是分组自由时间。只存在这支手机；用「分享」把链接发给大家。',
		'Day 6 13:00–17:00 is free time in groups. Saved on this phone; use Share to send it to the others.',
	],
};

const PLACES = {
	hotel: {
		name: ['示范旅店 中山', 'Sample Inn Zhongshan'],
		maps: 'Zhongshan Station Taipei',
		trad: '示範旅店 中山',
		addr: '台北市中山區（示範地址）',
		addrEn: 'Zhongshan District, Taipei (demo address)',
		note: ['中山站步行约5分钟（示范）', '5 min walk from Zhongshan MRT (demo)'],
	},
	tpe1: {
		name: ['桃园机场 第一航厦', 'Taoyuan Airport Terminal 1'],
		maps: 'Taoyuan International Airport Terminal 1',
		trad: '桃園機場 第一航廈',
		site: 'https://www.taoyuan-airport.com/',
	},
	tpe2: {
		name: ['桃园机场 第二航厦', 'Taoyuan Airport Terminal 2'],
		maps: 'Taoyuan International Airport Terminal 2',
		trad: '桃園機場 第二航廈',
		site: 'https://www.taoyuan-airport.com/',
	},
	a1: { name: ['机场捷运 A1 台北车站', 'Airport MRT A1 Taipei Main'], maps: 'A1 Taipei Main Station', trad: '機場捷運 A1 台北車站' },
	tpmain: { name: ['台北车站', 'Taipei Main Station'], maps: 'Taipei Main Station', trad: '台北車站' },
	shilin: { name: ['士林夜市', 'Shilin Night Market'], maps: 'Shilin Night Market', trad: '士林夜市' },
	longshan: { name: ['龙山寺', 'Longshan Temple'], maps: 'Lungshan Temple of Manka', trad: '龍山寺', site: 'https://www.lungshan.org.tw/' },
	bopiliao: { name: ['剥皮寮历史街区', 'Bopiliao Historic Block'], maps: 'Bopiliao Historical Block', trad: '剝皮寮歷史街區' },
	huashan: { name: ['华山1914文创园区', 'Huashan 1914 Creative Park'], maps: 'Huashan 1914 Creative Park', trad: '華山1914文化創意產業園區' },
	beitouStn: { name: ['新北投站', 'Xinbeitou Station'], maps: 'Xinbeitou Station', trad: '新北投站' },
	beitou: { name: ['北投温泉博物馆', 'Beitou Hot Spring Museum'], maps: 'Beitou Hot Spring Museum', trad: '北投溫泉博物館' },
	thermal: { name: ['地热谷', 'Thermal Valley'], maps: 'Beitou Thermal Valley', trad: '地熱谷' },
	yehliu: { name: ['野柳地质公园', 'Yehliu Geopark'], maps: 'Yehliu Geopark', trad: '野柳地質公園' },
	keelung: { name: ['基隆庙口夜市', 'Keelung Miaokou Night Market'], maps: 'Keelung Miaokou Night Market', trad: '基隆廟口夜市' },
	zoo: { name: ['猫空缆车 动物园站', 'Maokong Gondola, Zoo Station'], maps: 'Maokong Gondola Taipei Zoo Station', trad: '貓空纜車 動物園站' },
	maokong: { name: ['猫空', 'Maokong'], maps: 'Maokong Station', trad: '貓空' },
	concert: { name: ['国家音乐厅', 'National Concert Hall'], maps: 'National Concert Hall Taipei', trad: '國家音樂廳' },
	songshan: { name: ['松山文创园区', 'Songshan Cultural Park'], maps: 'Songshan Cultural and Creative Park', trad: '松山文創園區' },
	dihua: { name: ['迪化街', 'Dihua Street'], maps: 'Dihua Street Taipei', trad: '迪化街' },
	t101: { name: ['台北101观景台', 'Taipei 101 Observatory'], maps: 'Taipei 101 Observatory', trad: '台北101觀景台' },
	gearshop: { name: ['示范雪具店', 'Demo Snow Gear'], maps: 'Zhongxiao Dunhua Station', trad: '示範雪具店' },
};

const SITES = {
	metro: { name: ['台北捷运', 'Taipei Metro'], url: 'https://www.metro.taipei/' },
	tymetro: { name: ['桃园机场捷运', 'Taoyuan Airport MRT'], url: 'https://www.tymetro.com.tw/' },
	easycard: { name: ['悠游卡', 'EasyCard'], url: 'https://www.easycard.com.tw/' },
	youbike: { name: ['YouBike', 'YouBike'], url: 'https://www.youbike.com.tw/' },
	cwa: { name: ['中央气象署', 'Central Weather Administration'], url: 'https://www.cwa.gov.tw/' },
	cwaEn: { name: ['中央气象署（英文）', 'CWA (English)'], url: 'https://www.cwa.gov.tw/eng/' },
	twac: { name: ['入境登记表', 'Arrival card'], url: 'https://twac.immigration.gov.tw/' },
	lucky: { name: ['旅客抽奖活动（示范）', 'Visitor lucky draw (demo)'], url: 'https://example.org/lucky-draw' },
	luckyRules: { name: ['抽奖规则（示范）', 'Lucky draw rules (demo)'], url: 'https://example.org/lucky-draw/rules' },
	uber: { name: ['Uber', 'Uber'], url: 'https://www.uber.com/tw/' },
	concert: { name: ['国家音乐厅', 'National Concert Hall'], url: 'https://npac-ntch.org/' },
};

const FACTS = [
	{ k: ['日期', 'Dates'], v: ['2027年3月13日–3月19日', '13–19 Mar 2027'] },
	{ k: ['人数', 'Group'], v: ['5人（含2位长辈）', '5 people, 2 of them seniors'] },
	{ k: ['住宿', 'Stay'], v: ['示范旅店 中山（6晚）', 'Sample Inn Zhongshan (6 nights)'], place: 'hotel' },
	{ k: ['节奏', 'Pace'], v: ['每天2–3个点，午后休息', '2–3 stops a day, a rest after lunch'] },
];

const BACKUPS = [
	['下雨：华山文创、松山文创室内展', 'Rain: indoor shows at Huashan or Songshan'],
	['累了：回酒店休息，晚上再出门', 'Tired: rest at the hotel, go out again in the evening'],
	['台北101观景台（备选）', 'Taipei 101 Observatory (optional)'],
];

const DAYS = [
	{
		id: 'd1',
		n: 1,
		date: '2027-03-13',
		dow: ['六', 'Sat'],
		c: 1,
		foodSlots: ['d1-shilin'], // researched food (extra.json food[].slot) listed under the day
		freeEvening: true, // wishlist items that fit "any evening" are suggested here
		wish: '平安到',
		gloss: ['', 'Arrive safe'],
		mealAt: [
			[
				/晚餐/,
				[
					['dinner', ['d1-shilin']],
					['supper', ['d1-shilin']],
				],
			],
		],
		route: [
			['tpe1', 'hotel', 'transit'],
			['hotel', 'shilin', 'transit'],
		],
		tickets: ['easycard-buy'],
		title: ['抵达 → 酒店 → 士林夜市', 'Arrive → hotel → Shilin Night Market'],
		focus: ['落地、入住、轻松晚餐', 'Land, check in, an easy dinner'],
		photos: [],
		wear: ['短袖 + 薄外套', 'T-shirt + light jacket'],
		budgetChip: ['约 NT$2,000–3,000', '~NT$2,000–3,000'],
		schedule: [
			{
				t: '13:30',
				rel: { arr: [0] },
				what: ['降落桃园机场 T1', 'Land at Taoyuan T1'],
				fixed: true,
				place: 'tpe1',
				note: ['入境、领行李约45分钟', 'Immigration and bags ~45 min'],
			},
			{
				t: '~13:45–14:35',
				rel: { arr: [15, 65], about: 1 },
				what: ['入境、领行李、买悠游卡', 'Immigration, bags, buy EasyCards'],
				place: 'tpe1',
				note: ['悠游卡在捷运服务台买', 'EasyCards at the MRT service desk'],
			},
			{
				t: '~14:35–15:20',
				rel: { arr: [65, 110], about: 1 },
				what: ['机场捷运直达车到 A1', 'Airport MRT express to A1'],
				place: 'a1',
				note: ['直达车约35–40分钟', 'Express ~35–40 min'],
			},
			{
				t: '~15:20–16:20',
				rel: { arr: [110, 170], about: 1 },
				what: ['酒店入住，休息', 'Hotel check-in, rest'],
				place: 'hotel',
				note: ['先休息，晚上再出门', 'Rest first, go out in the evening'],
			},
			{
				t: '~18:30',
				rel: { arr: [245], about: 1, min: 1110 },
				what: ['士林夜市晚餐', 'Dinner at Shilin Night Market'],
				place: 'shilin',
				note: ['人多，长辈走慢一点', 'Crowded; slow pace for the seniors'],
			},
		],
		blocks: [
			{
				type: 'decide',
				icon: 'food',
				h: ['第一晚吃什么', 'First night: where to eat'],
				opts: [
					{
						k: 'a',
						mark: 'A',
						name: ['士林夜市', 'Shilin Night Market'],
						cost: ['NT$1,200–1,800 / 五人', 'NT$1,200–1,800 for 5'],
						place: 'shilin',
						when: ['精神还好就去', 'If everyone still has energy'],
						list: [
							['小吃为主，边走边吃', 'Street food, eat as you walk'],
							['地下美食区有座位', 'Seats in the basement food court'],
							['捷运剑潭站出来就到', 'Right by Jiantan MRT'],
						],
					},
					{
						k: 'b',
						mark: 'B',
						name: ['酒店附近简单吃', 'Something simple near the hotel'],
						cost: ['NT$1,000–1,500 / 五人', 'NT$1,000–1,500 for 5'],
						when: ['累了或下雨', 'Tired or raining'],
					},
				],
			},
			{
				type: 'wear',
				h: ['今天穿', 'What to wear'],
				main: ['短袖 + 薄外套 + 好走的鞋', 'T-shirt + light jacket + comfortable shoes'],
				note: ['飞机和捷运冷气强', 'Planes and trains are cold (strong AC)'],
			},
			{
				type: 'budget',
				h: ['第1天花费（估计）', 'Day 1 spend (estimate)'],
				est: true,
				rows: [
					[['机场捷运 × 5', 'Airport MRT × 5'], ['NT$800', 'NT$800'], 'train'],
					[['悠游卡押金与储值', 'EasyCard deposit and top-up'], ['NT$500', 'NT$500'], 'card'],
					[['晚餐', 'Dinner'], ['NT$1,000–1,800', 'NT$1,000–1,800'], 'food'],
				],
				total: ['约 NT$2,300–3,100 / 五人', '~NT$2,300–3,100 for 5'],
				min: 2300,
				max: 3100,
				note: ['示范价格，现场为准。', 'Demo prices; check on the day.'],
			},
		],
	},
	{
		id: 'd2',
		n: 2,
		date: '2027-03-14',
		dow: ['日', 'Sun'],
		c: 2,
		foodSlots: ['d2-lunch', 'd2-dinner'],
		wish: '慢慢逛',
		gloss: ['', 'Take it slow'],
		mealAt: [
			[/早餐/, [['breakfast', ['bk-hotel']]]],
			[/午餐/, [['lunch', ['d2-lunch']]]],
			[/回酒店/, [['dinner', ['d2-dinner']]]],
		],
		route: [
			['hotel', 'longshan', 'transit'],
			['longshan', 'bopiliao', 'walking'],
			['bopiliao', 'huashan', 'transit'],
			['huashan', 'hotel', 'transit'],
		],
		title: ['龙山寺 → 剥皮寮 → 华山文创', 'Longshan Temple → Bopiliao → Huashan'],
		focus: ['老城区，走路为主', 'Old town, mostly on foot'],
		photos: [],
		wear: ['短袖 + 帽子', 'T-shirt + hat'],
		budgetChip: ['约 NT$3,000–4,500', '~NT$3,000–4,500'],
		schedule: [
			{ t: '08:30', what: ['酒店早餐', 'Breakfast at the hotel'], place: 'hotel', note: ['慢慢吃', 'No rush'] },
			{ t: '09:30–11:00', what: ['龙山寺', 'Longshan Temple'], place: 'longshan', note: ['早上人少，安静参观', 'Quieter in the morning'] },
			{
				t: '11:00–12:00',
				what: ['剥皮寮老街', 'Bopiliao old street'],
				place: 'bopiliao',
				note: ['从龙山寺走过去约5分钟', '5 min walk from the temple'],
			},
			{ t: '12:00–13:30', what: ['午餐：万华小吃', 'Lunch: Wanhua snacks'], note: ['找有座位的店', 'Pick a place with seats'] },
			{
				t: '14:00–16:30',
				what: ['华山1914 文创园区', 'Huashan 1914 Creative Park'],
				place: 'huashan',
				note: ['室内展览，下雨也可以', 'Indoor shows, fine in rain'],
			},
			{ t: '17:00', what: ['回酒店休息', 'Back to the hotel to rest'], place: 'hotel', note: ['晚餐在酒店附近', 'Dinner near the hotel'] },
		],
		blocks: [
			{
				type: 'text',
				icon: 'train',
				h: ['今天怎么走', 'Getting around today'],
				p: [['捷运板南线到龙山寺站，出口1。', 'Bannan line to Longshan Temple, exit 1.']],
				total: { amt: 'NT$500–800', per: ['五人当天交通', 'transport for 5, all day'], min: 500, max: 800 },
			},
			{
				type: 'costs',
				icon: 'food',
				h: ['吃饭', 'Meals'],
				rows: [
					[
						['午餐 小吃', 'Lunch, snacks'],
						['NT$300–450 / 人', 'NT$300–450 each'],
					],
					[
						['晚餐 酒店附近', 'Dinner near the hotel'],
						['NT$1,500–2,250 / 五人', 'NT$1,500–2,250 for 5'],
					],
				],
			},
			{
				type: 'list',
				icon: 'bag',
				h: ['顺路看看', 'On the way'],
				list: [
					['龙山寺前的青草巷', 'Herb Lane next to the temple'],
					['剥皮寮的老照片展', 'Old photo displays at Bopiliao'],
				],
				places: ['longshan', 'bopiliao'],
			},
			{
				type: 'table',
				icon: 'sun',
				h: ['天气和穿着', 'Weather and clothing'],
				cols: [
					['时段', 'When'],
					['天气', 'Weather'],
					['穿着', 'Wear'],
				],
				rows: [
					[
						['上午', 'Morning'],
						['凉，可能有雾', 'Cool, maybe misty'],
						['薄外套', 'Light jacket'],
					],
					[
						['下午', 'Afternoon'],
						['温暖', 'Warm'],
						['短袖、帽子', 'T-shirt, hat'],
					],
				],
			},
			{
				type: 'budget',
				h: ['第2天花费', 'Day 2 spend'],
				rows: [
					[['交通', 'Transport'], ['NT$500–800', 'NT$500–800'], 'train'],
					[['午餐', 'Lunch'], ['NT$1,500–2,250', 'NT$1,500–2,250'], 'food'],
					[['晚餐', 'Dinner'], ['NT$1,500–2,250', 'NT$1,500–2,250'], 'food'],
				],
				total: ['约 NT$3,500–5,300 / 五人', '~NT$3,500–5,300 for 5'],
				min: 3500,
				max: 5300,
			},
			{
				type: 'rain',
				h: ['下雨的话', 'If it rains'],
				list: [
					['华山室内展可以待久一点', 'Stay longer in the Huashan halls'],
					['坐计程车，不要走太远', 'Take taxis instead of long walks'],
				],
			},
		],
	},
	{
		id: 'd3',
		n: 3,
		date: '2027-03-15',
		dow: ['一', 'Mon'],
		c: 3,
		foodSlots: ['d3-lunch'],
		wish: '泡温泉',
		gloss: ['', 'Hot springs'],
		mealAt: [
			[/早餐/, [['breakfast', ['bk-hotel']]]],
			[/午餐/, [['lunch', ['d3-lunch']]]],
		],
		route: [
			['hotel', 'beitouStn', 'transit'],
			['beitouStn', 'beitou', 'walking'],
			['beitou', 'thermal', 'walking'],
			['thermal', 'hotel', 'transit'],
		],
		title: ['北投温泉 → 地热谷', 'Beitou hot springs → Thermal Valley'],
		focus: ['泡汤、散步', 'A soak and a stroll'],
		photos: [],
		wear: ['短袖 + 薄外套', 'T-shirt + light jacket'],
		budgetChip: ['约 NT$3,500–5,000', '~NT$3,500–5,000'],
		schedule: [
			{ t: '09:00', what: ['酒店早餐', 'Breakfast at the hotel'], place: 'hotel', note: ['带毛巾', 'Bring a towel'] },
			{
				t: '10:00–10:40',
				what: ['捷运到新北投', 'MRT to Xinbeitou'],
				place: 'beitouStn',
				note: ['北投站换支线', 'Change at Beitou for the branch line'],
			},
			{
				t: '10:45–12:00',
				what: ['北投温泉博物馆', 'Beitou Hot Spring Museum'],
				place: 'beitou',
				note: ['周一休馆时改去地热谷', 'Closed Mondays in some seasons: go to Thermal Valley first'],
			},
			{ t: '12:00–13:30', what: ['午餐', 'Lunch'], note: ['温泉区附近', 'Near the spa street'] },
			{ t: '13:30–15:00', what: ['地热谷', 'Thermal Valley'], place: 'thermal', note: ['路有点斜，慢慢走', 'Gentle slope; walk slowly'] },
			{
				t: '15:00–17:00',
				what: ['泡汤（大众池或包厢）', 'Hot spring soak (public pool or private room)'],
				place: 'beitou',
				note: ['长辈泡15分钟就起来休息', 'Seniors: 15 min at a time, then rest'],
			},
			{ t: '18:00', what: ['回市区晚餐', 'Back to town for dinner'], place: 'hotel', note: ['酒店附近', 'Near the hotel'] },
		],
		blocks: [
			{
				type: 'route',
				icon: 'train',
				h: ['捷运怎么坐', 'The MRT ride'],
				stops: [
					{ name: ['中山', 'Zhongshan'], code: 'R11', line: 'red' },
					{ name: ['淡水信义线', 'Tamsui–Xinyi line'], line: 'red', isLine: true },
					{ name: ['北投', 'Beitou'], code: 'R22', line: 'red', xfer: true },
					{ name: ['新北投', 'Xinbeitou'], code: 'R22A', line: 'red' },
				],
				note: ['中山到新北投约30分钟。', 'Zhongshan to Xinbeitou ~30 min.'],
				total: { amt: 'NT$400–600', per: ['五人来回', 'return trip for 5'], min: 400, max: 600 },
				note2: ['回程可以坐计程车。', 'Take a taxi back if tired.'],
				places: ['beitouStn', 'beitou'],
				sites: ['metro'],
			},
			{
				type: 'weather',
				icon: 'cloud',
				h: ['下雨还去吗', 'Rain: still go?'],
				flow: true,
				opts: [
					{
						k: 'go',
						name: ['小雨照去', 'Light rain: go'],
						list: [
							['温泉本来就是湿的', 'You get wet anyway'],
							['博物馆在室内', 'The museum is indoors'],
						],
					},
					{
						k: 'wait',
						name: ['大雨改天', 'Heavy rain: swap days'],
						list: [
							['和第5天对调', 'Swap with Day 5'],
							['先去华山室内展', 'Indoor shows at Huashan instead'],
						],
						body: ['雷雨不要泡汤。', 'No soaking in a thunderstorm.'],
					},
				],
			},
			{
				type: 'wear',
				h: ['今天穿', 'What to wear'],
				main: ['好穿脱的衣服 + 拖鞋', 'Easy-off clothes + sandals'],
				note: ['带换洗衣服', 'Pack a change of clothes'],
			},
			{
				type: 'budget',
				h: ['第3天花费', 'Day 3 spend'],
				rows: [
					[['交通', 'Transport'], ['NT$400–600', 'NT$400–600'], 'train'],
					[['泡汤', 'Hot spring'], ['NT$1,000–1,500', 'NT$1,000–1,500'], 'ticket'],
					[['午餐 + 晚餐', 'Lunch + dinner'], ['NT$2,000–3,000', 'NT$2,000–3,000'], 'food'],
				],
				total: ['约 NT$3,400–5,100 / 五人', '~NT$3,400–5,100 for 5'],
				min: 3400,
				max: 5100,
			},
			{ type: 'rain', h: ['下雨的话', 'If it rains'], list: [['和第5天对调', 'Swap with Day 5']] },
		],
	},
	{
		id: 'd4',
		n: 4,
		date: '2027-03-16',
		dow: ['二', 'Tue'],
		c: 4,
		freeEvening: true,
		wish: '看海去',
		gloss: ['', 'To the sea'],
		route: [
			['hotel', 'yehliu', 'driving'],
			['yehliu', 'keelung', 'driving'],
			['keelung', 'hotel', 'driving'],
		],
		title: ['包车：野柳 → 基隆', 'Charter: Yehliu → Keelung'],
		focus: ['北海岸一日，包车', 'North coast by charter car'],
		photos: [],
		wear: ['长袖 + 防风外套', 'Long sleeves + windbreaker'],
		budgetChip: ['约 NT$7,500–9,500', '~NT$7,500–9,500'],
		schedule: [
			{
				t: '09:00',
				what: ['包车在酒店门口接', 'Charter pickup at the hotel door'],
				fixed: true,
				place: 'hotel',
				note: ['司机准时到', 'The driver comes on time'],
			},
			{ t: '10:15–12:00', what: ['野柳地质公园', 'Yehliu Geopark'], place: 'yehliu', note: ['风大，看女王头', 'Windy; see the Queen’s Head'] },
			{ t: '12:15–13:30', what: ['午餐：海鲜', 'Lunch: seafood'], note: ['司机推荐', 'Driver’s pick'] },
			{ t: '14:30–16:00', what: ['基隆港边散步', 'Keelung harbour walk'], place: 'keelung', note: ['可以在车上休息', 'Rest in the car if tired'] },
			{
				t: '16:00–18:00',
				what: ['基隆庙口夜市', 'Keelung Miaokou Night Market'],
				place: 'keelung',
				note: ['早点吃，人少', 'Eat early, fewer crowds'],
			},
			{ t: '19:00', what: ['回到酒店', 'Back at the hotel'], place: 'hotel', note: ['包车结束', 'Charter ends'] },
		],
		blocks: [
			{
				type: 'kv',
				icon: 'van',
				h: ['包车资料', 'Charter details'],
				rows: [
					[
						['人数', 'People'],
						['5人', '5'],
					],
					[
						['车型', 'Car'],
						['7人座', '7-seater'],
					],
					[
						['时长', 'Hours'],
						['10小时', '10 hours'],
					],
				],
				note: ['示范报价：10小时 **NT$5,500**，超时每小时 NT$500。', 'Demo quote: 10 h **NT$5,500**, NT$500 per extra hour.'],
			},
			{ type: 'text', icon: 'info', h: ['提醒', 'Good to know'], p: [['野柳风大，长辈戴帽子。', 'Yehliu is windy; seniors wear hats.']] },
			{
				type: 'checklist',
				id: 'charter',
				icon: 'list',
				h: ['出发前确认', 'Before we go'],
				items: [
					['司机电话存好了吗？', 'Driver’s number saved?'],
					['现金够付包车吗？', 'Enough cash for the charter?'],
				],
			},
			{
				type: 'costs',
				icon: 'money',
				h: ['费用', 'Costs'],
				rows: [
					[
						['包车 10小时', 'Charter, 10 h'],
						['NT$5,500 / 五人', 'NT$5,500 for 5'],
					],
					[
						['野柳门票', 'Yehliu tickets'],
						['NT$400 / 五人', 'NT$400 for 5'],
					],
				],
			},
			{
				type: 'wear',
				h: ['今天穿', 'What to wear'],
				main: ['长袖 + 防风外套', 'Long sleeves + windbreaker'],
				note: ['海边比市区冷', 'The coast is colder than the city'],
			},
			{
				type: 'budget',
				h: ['第4天花费', 'Day 4 spend'],
				rows: [
					[['包车', 'Charter'], ['NT$5,500', 'NT$5,500'], 'van'],
					[['门票', 'Tickets'], ['NT$400', 'NT$400'], 'ticket'],
					[['午餐 + 晚餐', 'Lunch + dinner'], ['NT$2,000–3,500', 'NT$2,000–3,500'], 'food'],
				],
				total: ['约 NT$7,900–9,400 / 五人', '~NT$7,900–9,400 for 5'],
				min: 7900,
				max: 9400,
			},
			{ type: 'rain', h: ['下雨的话', 'If it rains'], list: [['野柳缩短，多留在基隆室内', 'Shorter Yehliu stop, more time indoors in Keelung']] },
		],
	},
	{
		id: 'd5',
		n: 5,
		date: '2027-03-17',
		dow: ['三', 'Wed'],
		c: 5,
		foodSlots: ['d5-lunch'],
		wish: '上山听歌',
		gloss: ['', 'Up the hill, then music'],
		mealAt: [
			[/早餐/, [['breakfast', ['bk-hotel']]]],
			[/喝茶/, [['lunch', ['d5-lunch']]]],
		],
		route: [
			['hotel', 'zoo', 'transit'],
			['zoo', 'maokong', 'transit'],
			['maokong', 'hotel', 'transit'],
			['hotel', 'concert', 'transit'],
			['concert', 'hotel', 'transit'],
		],
		title: ['猫空缆车 → 音乐会', 'Maokong Gondola → concert'],
		focus: ['缆车喝茶，晚上音乐会', 'Gondola and tea, a concert at night'],
		photos: [],
		wear: ['短袖 + 薄外套', 'T-shirt + light jacket'],
		budgetChip: ['约 NT$8,000–10,000', '~NT$8,000–10,000'],
		schedule: [
			{ t: '09:30', what: ['酒店早餐', 'Breakfast at the hotel'], place: 'hotel', note: ['慢慢来', 'Take your time'] },
			{ t: '10:30–11:00', what: ['捷运到动物园站', 'MRT to Taipei Zoo'], place: 'zoo', note: ['文湖线终点', 'End of the Wenhu line'] },
			{
				t: '11:00–14:00',
				what: ['猫空缆车 + 喝茶', 'Maokong Gondola + tea'],
				place: 'maokong',
				note: ['缆车约30分钟，山上喝茶吃午餐', 'Gondola ~30 min; tea and lunch on the hill'],
			},
			{ t: '14:30–17:30', what: ['回酒店休息', 'Rest at the hotel'], place: 'hotel', note: ['晚上要出门，先休息', 'Rest before the evening out'] },
			{ t: '18:00', what: ['音乐厅附近晚餐', 'Dinner near the Concert Hall'], place: 'concert', note: ['早点吃', 'Eat early'] },
			{
				t: '19:10',
				what: ['到音乐厅门口集合', 'Meet at the Concert Hall door'],
				fixed: true,
				place: 'concert',
				note: ['迟到不能进场', 'No entry once it starts'],
			},
			{
				t: '19:30–21:00',
				what: ['音乐会', 'Concert'],
				fixed: true,
				place: 'concert',
				link: 'concert',
				note: ['票已买好（示范）', 'Tickets bought (demo)'],
			},
		],
		blocks: [
			{
				type: 'text',
				icon: 'ticket',
				h: ['音乐会', 'The concert'],
				p: [['19:10 门口集合，19:30 开始。', 'Meet 19:10 at the door; starts 19:30.']],
				total: { amt: 'NT$5,000', per: ['五人门票', 'tickets for 5'], min: 5000, max: 5000 },
			},
			{
				type: 'list',
				icon: 'info',
				h: ['缆车小提醒', 'Gondola tips'],
				list: [
					['周一维修停驶，周三正常', 'Closed Mondays for maintenance; Wednesday is fine'],
					['水晶车厢要另外排队', 'Glass-floor cabins have their own queue'],
				],
				places: ['zoo', 'maokong'],
			},
			{ type: 'wear', h: ['今天穿', 'What to wear'], main: ['短袖 + 薄外套', 'T-shirt + light jacket'], note: ['山上比较凉', 'Cooler up the hill'] },
			{
				type: 'budget',
				h: ['第5天花费', 'Day 5 spend'],
				rows: [
					[['音乐会门票', 'Concert tickets'], ['NT$5,000', 'NT$5,000'], 'ticket'],
					[['缆车 + 交通', 'Gondola + transport'], ['NT$800–1,000', 'NT$800–1,000'], 'train'],
					[['吃饭', 'Meals'], ['NT$2,500–3,500', 'NT$2,500–3,500'], 'food'],
				],
				total: ['约 NT$8,300–9,500 / 五人', '~NT$8,300–9,500 for 5'],
				min: 8300,
				max: 9500,
			},
			{
				type: 'rain',
				h: ['下雨的话', 'If it rains'],
				list: [['缆车照开，但看不到风景：改去华山', 'The gondola runs but the view is gone: go to Huashan']],
			},
		],
	},
	{
		id: 'd6',
		n: 6,
		date: '2027-03-18',
		dow: ['四', 'Thu'],
		c: 6,
		foodSlots: ['d6-meals'],
		freeFrom: '13:00', // this day's free time starts here: it gets the free-time ideas list
		wish: '买买买再见',
		gloss: ['', 'Shop, then fly'],
		mealAt: [
			[/午餐/, [['lunch', ['d6-meals']]]],
			[/晚餐/, [['dinner', ['d6-meals']]]],
		],
		route: [
			['hotel', 'dihua', 'transit'],
			['dihua', 'songshan', 'transit'],
			['songshan', 'hotel', 'transit'],
			['hotel', 'tpe1', 'driving'],
		],
		title: ['迪化街 → 自由购物 → 机场', 'Dihua Street → free shopping → airport'],
		focus: ['最后一天，分组自由活动', 'Last day, free time in groups'],
		photos: [],
		wear: ['短袖 + 薄外套', 'T-shirt + light jacket'],
		budgetChip: ['约 NT$3,000–5,000', '~NT$3,000–5,000'],
		schedule: [
			{
				t: '11:00',
				what: ['退房，行李寄放酒店', 'Check out, leave bags at the hotel'],
				fixed: true,
				place: 'hotel',
				note: ['寄放到晚上', 'Bags stay until the evening'],
			},
			{ t: '11:30–13:00', what: ['迪化街午餐', 'Lunch on Dihua Street'], place: 'dihua', note: ['南北货、干果', 'Dried goods and snacks'] },
			{
				t: '13:00–17:00',
				what: ['分组自由购物', 'Free shopping in groups'],
				place: 'songshan',
				shops: true, // the trip's shop list (shops.json) goes under this stop
				note: ['各自逛，保持联络', 'Split up, keep in touch'],
			},
			{
				t: '17:40–18:55',
				rel: { dep: [-425, -350] },
				what: ['酒店附近晚餐', 'Dinner near the hotel'],
				place: 'hotel',
				note: ['吃完回酒店拿行李', 'Then collect the bags'],
			},
			{
				t: '~19:40',
				rel: { dep: [-305], about: 1 },
				what: ['出发去机场', 'Leave for the airport'],
				fixed: true,
				place: 'hotel',
				note: ['叫两台计程车或机场捷运', 'Two taxis or the Airport MRT'],
			},
			{
				t: '20:55–21:25',
				rel: { dep: [-230, -200] },
				what: ['T1 办理登机', 'Check in at T1'],
				place: 'tpe1',
				note: ['退税柜台在出境前', 'Tax refund desk before security'],
			},
			{
				t: '00:45',
				rel: { dep: [0], next: 1 },
				what: ['航班起飞', 'Flight departs'],
				fixed: true,
				place: 'tpe1',
				note: ['隔天凌晨', 'Just after midnight'],
			},
		],
		blocks: [
			{
				type: 'groups',
				icon: 'bag',
				h: ['分组去哪', 'Where each group goes'],
				groups: [
					{
						h: ['逛街组', 'Shoppers'],
						list: [
							['松山文创园区', 'Songshan Cultural Park'],
							['信义区百货', 'Xinyi department stores'],
							['伴手礼店', 'Gift shops'],
						],
					},
					{
						h: ['休息组（长辈）', 'Rest group (seniors)'],
						list: [
							['酒店附近喝茶', 'Tea near the hotel'],
							['迪化街慢慢逛', 'A slow walk on Dihua Street'],
						],
					},
				],
				note: ['17:40 前回到酒店附近。', 'Be back near the hotel by 17:40.'],
			},
			{
				type: 'text',
				icon: 'plane',
				h: ['去机场', 'To the airport'],
				p: [['两台计程车最省力，机场捷运最省钱。', 'Two taxis are easiest; the Airport MRT is cheapest.']],
			},
			{
				type: 'checklist',
				id: 'lastday',
				icon: 'list',
				h: ['离开前', 'Before leaving'],
				items: [
					['护照都在身上吗？', 'Everyone has a passport?'],
					['退税单收好了吗？', 'Tax refund forms kept?'],
				],
			},
			{
				type: 'wear',
				h: ['今天穿', 'What to wear'],
				main: ['好走的鞋 + 飞机上的外套', 'Walking shoes + a jacket for the plane'],
				note: ['晚上飞机冷', 'Night flights are cold'],
			},
			{
				type: 'budget',
				h: ['第6天花费', 'Day 6 spend'],
				rows: [
					[['吃饭', 'Meals'], ['NT$2,000–3,000', 'NT$2,000–3,000'], 'food'],
					[['去机场', 'To the airport'], ['NT$800–2,400', 'NT$800–2,400'], 'car'],
				],
				total: ['约 NT$2,800–5,400 / 五人', '~NT$2,800–5,400 for 5'],
				min: 2800,
				max: 5400,
			},
		],
	},
	{
		id: 'd7',
		n: 7,
		date: '2027-03-19',
		dow: ['五', 'Fri'],
		c: 7,
		wish: '回家',
		gloss: ['', 'Home'],
		title: ['凌晨起飞 → 回家', 'Early flight → home'],
		focus: ['在飞机上睡觉', 'Sleep on the plane'],
		photos: [],
		schedule: [
			{ t: '00:45', rel: { dep: [0] }, what: ['起飞', 'Take off'], fixed: true, place: 'tpe1', note: ['在飞机上睡', 'Sleep on the plane'] },
			{ t: '05:25', rel: { dep: [280] }, what: ['抵达吉隆坡', 'Land in Kuala Lumpur'], fixed: true, note: ['到家了', 'Home again'] },
		],
		blocks: [],
	},
];

const OPTIONAL = [
	{
		id: 'opt-101',
		place: 't101',
		photo: '',
		ticket: 't101',
		name: ['台北101观景台', 'Taipei 101 Observatory'],
		meta: ['不排进行程', 'Not scheduled'],
		when: ['天气好的傍晚', 'A clear evening'],
		list: [
			['晴天才值得', 'Only worth it on a clear day'],
			['排队约30分钟', 'Queue ~30 min'],
			['门票每人 NT$600，NT$3,000 / 五人', 'Tickets NT$600 each, NT$3,000 for 5'],
		],
		cost: ['门票 **NT$3,000** / 五人', 'Tickets **NT$3,000** for 5'],
		note: ['第6天自由时间也可以去。', 'Fits the Day 6 free time too.'],
	},
];

const SNOW = {
	lede: ['**不用买雪具**：只看看，不排进行程。', '**No gear needed**: just a look, never scheduled.'],
	lede2: ['想看的话第6天自由时间去。', 'If you want to look, go in the Day 6 free time.'],
	shops: [
		{
			place: 'gearshop',
			name: ['示范雪具店', 'Demo Snow Gear'],
			area: ['忠孝敦化', 'Zhongxiao Dunhua'],
			when: ['第6天下午', 'Day 6 afternoon'],
			rank: ['只看看', 'Browse only'],
			list: [['示范店，不是真的店', 'A demo shop, not a real one']],
			day: 'd6',
		},
	],
	rule: ['不排进行程。', 'Never scheduled.'],
	checks: [['先量好脚的尺寸', 'Measure your feet first']],
	close: ['想买再说。', 'Decide later.'],
};

const BUDGET = {
	excludes: [
		['机票', 'Flights'],
		['酒店（已付）', 'Hotel (paid)'],
	],
	rows: [
		[['机场来回', 'Airport, both ways'], 'NT$1,600–3,200', 1600, 3200, 'airport'],
		[['市内交通', 'Local transport'], 'NT$2,000–3,000', 2000, 3000],
		[['包车一天', 'Charter car, one day'], '**NT$5,500**', 5500, 5500],
		[['门票与活动', 'Tickets and activities'], 'NT$6,400–7,000', 6400, 7000],
		[['吃饭', 'Meals'], 'NT$12,000–18,000', 12000, 18000],
	],
	total: ['合计 NT$27,500–36,700', 'Total NT$27,500–36,700'],
	totalMin: 27500,
	totalMax: 36700,
	per: ['每人 NT$5,500–7,340', 'NT$5,500–7,340 each'],
	split: ['包车和计程车按车算，人少也不便宜。', 'Charter and taxis are per vehicle, so fewer people don’t pay less.'],
	suggest: ['公费 NT$40,000，最后多退少补。', 'A group pot of NT$40,000; settle up at the end.'],
	pool: 40000,
	poolText: ['公费 NT$40,000', 'Group pot NT$40,000'],
	airportNote: ['Day 1搭机场捷运比接送省约NT$600–1,200', 'Day 1 Airport MRT vs van saves ~NT$600–1,200'],
	chartNote: ['虚线框 = 估算。不含购物。', 'Dashed = estimate. Excludes shopping.'],
};

const MONEY = {
	cash: {
		amt: 'NT$12,000–18,000',
		uses: [
			['夜市和小吃', 'Night markets and snacks'],
			['包车', 'The charter car'],
		],
	},
	card: [['百货和超市可以刷卡', 'Cards work in malls and supermarkets']],
	easycard: ['每人先储值 **NT$500**，不够再加。', 'Top up **NT$500** each to start; add more when low.'],
};

const WEATHER = {
	lede: ['三月台北早晚凉，白天暖，常有小雨。', 'Taipei in March: cool mornings and evenings, warm days, frequent light rain.'],
	when: [
		{ d: '2027-03-06', t: ['出发前一周', 'A week before'], v: ['看长期预报', 'Check the long-range forecast'] },
		{ t: ['每天早上', 'Every morning'], v: ['看当天预报', 'Check the day’s forecast'] },
	],
	items: [
		['折叠伞', 'Folding umbrella'],
		['薄外套', 'Light jacket'],
	],
	outfits: [
		{ h: ['市区', 'City'], main: ['短袖 + 薄外套', 'T-shirt + light jacket'], note: ['捷运冷气强。', 'Strong AC on trains.'], day: 'd2' },
		{ h: ['海边', 'Coast'], main: ['长袖 + 防风外套', 'Long sleeves + windbreaker'], note: ['风大。', 'Windy.'], day: 'd4' },
	],
};

const TAX = {
	h: ['外国旅客退税', 'Tourist tax refund'],
	list: [
		['同一天同一家店买满 NT$2,000', 'Spend NT$2,000+ in one shop on one day'],
		['找有退税标志的店', 'Look for the tax-refund sign'],
		['机场出境前领退税', 'Claim at the airport before security'],
	],
	shops: ['百货公司大多可以退税。', 'Most department stores offer it.'],
	note: ['示范规则，出发前再查。', 'Demo rules; check before you go.'],
};

const FLIGHTS = {
	out: {
		no: 'XX 188',
		dep: '08:40',
		arr: '13:30',
		date: '2027-03-13',
		from: ['吉隆坡', 'Kuala Lumpur'],
		to: ['桃园 T1', 'Taoyuan T1'],
		dur: '4h 50m',
	},
	ret: {
		no: 'XX 189',
		dep: '00:45',
		arr: '05:25',
		date: '2027-03-19',
		from: ['桃园 T1', 'Taoyuan T1'],
		to: ['吉隆坡', 'Kuala Lumpur'],
		dur: '4h 40m',
		// the airport evening, in minutes before take-off: back at the hotel for the bags, leave, at the airport;
		// latest = the last sensible arrival at the airport, road = the longest drive there
		plan: {
			back: 350,
			leave: 305,
			airport: 230,
			latest: 180,
			road: 75,
			route: [
				'桃园 T1 → 吉隆坡。登机时间在值机后的登机证上（通常起飞前约45分钟）。',
				'Taoyuan T1 → Kuala Lumpur. Boarding time is on the boarding pass after check-in (usually ~45 min before).',
			],
			// `at`: "HH:MM" or minutes before take-off; {latest} = the latest time to leave, {-N} = N minutes before take-off
			steps: [
				{ at: ['13:00', 440], what: ['自由时间：下面「自由时间去哪」点＋加入', 'Free time: add places from "Free-time ideas" below'] },
				{ at: [425], what: ['集合吃晚餐', 'Meet up for dinner'] },
				{ by: true, at: [350], what: ['回酒店拿行李（约45分钟整理）', 'Back at the hotel for the bags (~45 min)'] },
				{
					at: [305, 290],
					what: [
						'出发去机场（最晚约{latest}）：计程车约60分钟，机场捷运约70分钟',
						'Leave for the airport (latest ~{latest}): taxi ~60 min, Airport MRT ~70',
					],
				},
				{
					at: [230, 200],
					what: [
						'到 T1：柜台约起飞前3小时开（约{-180}），早到排前面',
						'At T1: counters open ~3 h before (~{-180}); early means near the front of the queue',
					],
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
		id: 'before',
		h: ['出发前', 'Before the trip'],
		items: [
			{ id: 'passport', t: ['护照有效期6个月以上', 'Passports valid 6+ months'] },
			{ id: 'arrival', t: ['填好入境登记表', 'Fill in the arrival card'], site: 'twac' },
			{ id: 'concert', t: ['音乐会门票已买（示范）', 'Concert tickets bought (demo)'], sub: ['五人 NT$5,000', 'NT$5,000 for 5'], site: 'concert' },
			{ id: 'charter', t: ['包车已预约（示范）', 'Charter car booked (demo)'] },
		],
	},
	{
		id: 'pack',
		h: ['行李', 'Packing'],
		items: [
			{ id: 'umbrella', t: ['折叠伞', 'Folding umbrella'] },
			{ id: 'meds', t: ['长辈的药', 'Seniors’ medicines'], sub: ['放随身包', 'In the carry-on'] },
			{ id: 'adapter', t: ['插头不用转换（示范）', 'No plug adapter needed (demo)'] },
		],
	},
];

const PRIORITIES = {
	must: [
		['长辈舒服，不赶路', 'Seniors comfortable, no rushing'],
		['音乐会准时到', 'On time for the concert'],
	],
	should: [['泡一次温泉', 'One hot spring soak']],
	mood: [['慢慢走，多休息', 'Walk slowly, rest often']],
};

const PRINCIPLE = {
	wish: '慢慢走',
	p: [
		['每天最多三个地方', 'At most three places a day'],
		['长辈累了就回酒店', 'When the seniors tire, back to the hotel'],
		['固定时间不能迟到', 'Fixed times are never late'],
	],
};

const AIRPORT = {
	lede: ['落地后大多数人搭机场捷运，行李多就叫车。', 'Most of us take the Airport MRT after landing; lots of bags means a car.'],
	facts: [
		{ k: ['机场捷运票价', 'Airport MRT fare'], v: ['T1 → A1 每人 NT$160', 'T1 → A1 NT$160 each'] },
		{ k: ['直达车时间', 'Express time'], v: ['约35–40分钟', '~35–40 min'] },
	],
	methods: [
		{
			id: 'mix',
			pick: true,
			icon: 'train',
			short: ['捷运+车', 'MRT + car'],
			name: ['捷运 + 行李车', 'MRT + a car for bags'],
			sub: ['推荐', 'Recommended'],
			min: 1100,
			max: 1300,
			cost: 'NT$1,100–1,300',
			per: ['每人约 NT$220–260 / 人', 'about NT$220–260 each'],
			time: ['约60分钟', '~60 min'],
			xfer: ['A1 换计程车', 'Taxi from A1'],
			bags: ['行李坐车', 'Bags go by car'],
			list: [['长辈和行李坐车', 'Seniors and bags by car']],
			when: ['行李多', 'Lots of bags'],
		},
		{
			id: 'mrt',
			icon: 'train',
			short: ['捷运', 'MRT'],
			name: ['全部搭机场捷运', 'Everyone on the Airport MRT'],
			sub: ['最便宜', 'Cheapest'],
			min: 800,
			max: 800,
			cost: 'NT$800',
			per: ['NT$160 / 人', 'NT$160 each'],
			time: ['约50分钟', '~50 min'],
			xfer: ['A1 走到酒店', 'Walk from A1'],
			bags: ['自己推', 'Bring your own'],
			list: [['最省钱', 'Saves the most']],
			when: ['行李少', 'Light bags'],
		},
		{
			id: 'van',
			icon: 'van',
			short: ['接送', 'Van'],
			name: ['预约机场接送', 'Pre-booked airport van'],
			sub: ['最省力', 'Least effort'],
			min: 1400,
			max: 2000,
			cost: 'NT$1,400–2,000',
			per: ['每人约 NT$280–400 / 人', 'about NT$280–400 each'],
			time: ['约50分钟', '~50 min'],
			xfer: ['门到门', 'Door to door'],
			bags: ['司机帮搬', 'Driver helps'],
			list: [['要提前预约', 'Book ahead']],
			when: ['航班很晚', 'Very late flight'],
		},
		{
			id: 'uber',
			icon: 'car',
			short: ['Uber×2', 'Uber×2'],
			name: ['两台 Uber', 'Two Ubers'],
			sub: ['随叫随到', 'On demand'],
			min: 2400,
			max: 3600,
			cost: 'NT$2,400–3,600',
			per: ['每人约 NT$480–720 / 人', 'about NT$480–720 each'],
			time: ['约45分钟', '~45 min'],
			xfer: ['门到门', 'Door to door'],
			bags: ['后车厢', 'In the boot'],
			list: [['高峰期会贵', 'Surge pricing at peak']],
			when: ['赶时间', 'In a hurry'],
		},
	],
	rule: [
		{ k: 'go', name: ['准时落地：机场捷运', 'On time: Airport MRT'], list: [['领完行李就去捷运站', 'Straight to the MRT after bags']] },
		{ k: 'wait', name: ['晚到：看情况', 'Late: decide on the spot'], list: [['晚上8点后落地叫车', 'Landing after 20:00: take a car']] },
		{
			k: 'stop',
			name: ['很晚：接送', 'Very late: the van'],
			list: [['晚上10点后落地用接送', 'Landing after 22:00: use the van']],
			body: ['提前一天确认。', 'Confirm a day ahead.'],
		},
	],
	steps: [
		['跟着紫色标志找机场捷运', 'Follow the purple signs to the Airport MRT'],
		['搭直达车（紫色）到 A1', 'Take the express (purple) to A1'],
		['A1 出站走到台北车站', 'Walk from A1 to Taipei Main'],
	],
	easycard: [
		['机场捷运服务台买', 'Buy at the Airport MRT desk'],
		['押金已含在卡价', 'The deposit is in the card price'],
	],
	route: [
		{ code: 'A12 / A13', name: ['机场第一 / 第二航厦', 'Airport T1 / T2'], line: 'purple' },
		{ seg: ['直达车 · 约35–40分钟 · NT$160', 'Express · ~35–40 min · NT$160'], line: 'purple' },
		{ code: 'A1', name: ['台北车站', 'Taipei Main Station'], line: 'purple', fork: true },
	],
	depart: {
		lede: ['回程：3月18日晚上从酒店出发。', 'Going home: leave the hotel on the evening of 18 Mar.'],
		list: [
			['提前3小时到机场', 'At the airport 3 hours early'],
			['退税在出境前办', 'Tax refund before security'],
		],
	},
	sourceNote: ['示范资料，出发前请查官方网站。', 'Demo information; check the official sites before you go.'],
};

const ENTRY = {
	rules: [
		{
			h: ['免签入境', 'Visa-free entry'],
			p: ['示范：马来西亚护照免签30天（出发前再查）。', 'Demo: Malaysian passports get 30 days visa-free (check before you go).'],
			site: 'twac',
		},
	],
	lucky: {
		name: ['旅客抽奖活动（示范）', 'Visitor lucky draw (demo)'],
		period: ['示范活动期间', 'Demo campaign period'],
		deadline: ['出发前 **7天** 登记', 'Register **7 days** before arriving'],
		who: [
			['外国旅客', 'Foreign visitors'],
			['示范：重游旅客 **NT$5,000**', 'Demo: repeat visitors **NT$5,000**'],
		],
		how: [
			['上网登记', 'Register online'],
			['入境时抽奖', 'Draw on arrival'],
		],
		unsure: ['示范内容，不是真的活动。', 'Demo content, not a real campaign.'],
	},
};

const ENTRY_CHECKS = {
	id: 'entry',
	h: ['入境准备', 'Entry prep'],
	items: [
		{ id: 'entry-card', t: ['填入境登记表', 'Fill in the arrival card'], due: '2027-03-10', site: 'twac' },
		{ id: 'entry-lucky', t: ['登记旅客抽奖（示范）', 'Register for the lucky draw (demo)'], due: '2027-03-06', sub: ['示范', 'Demo'] },
	],
};
