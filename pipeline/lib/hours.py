"""Opening hours and addresses as Google returns them in zh-TW: weekly hours → the page's day list and text, the trip
days a place is shut, and Taiwan addresses without postcode, country or village (里)."""
import re
from lib.trip import WEEKDAY, FLIGHT_DATE

DZH = ['一', '二', '三', '四', '五', '六', '日']; DEN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
WK = {'星期' + d: i for i, d in enumerate(DZH)}
def parse_hours(desc):
    days = [None] * 7
    for line in desc or []:
        k, _, v = line.partition(': ')
        if k not in WK: continue
        v = v.strip()
        if '休息' in v: days[WK[k]] = 'closed'
        elif '24 小時' in v: days[WK[k]] = '24h'
        else:
            spans = re.findall(r'(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})', v)
            days[WK[k]] = ','.join(f'{a}–{b}' for a, b in spans) if spans else v
    return days if all(days) else None
def day_groups(days):
    groups = []  # consecutive days with the same hours
    for i, h in enumerate(days):
        if groups and groups[-1][1] == h and groups[-1][0][-1] == i - 1: groups[-1][0].append(i)
        else: groups.append(([i], h))
    # merge non-consecutive groups with identical hours
    merged = {}
    for ds, h in groups: merged.setdefault(h, []).append(ds)
    return merged
def fmt_hours(days):
    if len(set(days)) == 1:
        h = days[0]; return (('24小时营业' if h == '24h' else '每天 ' + h.replace(',', '、')), ('Open 24 h' if h == '24h' else 'Daily ' + h.replace(',', ', ')))
    zh, en = [], []
    order = sorted(day_groups(days).items(), key=lambda kv: (kv[0] == 'closed', kv[1][0][0]))
    for h, runs in order:
        dz = '、'.join(('周' + DZH[r[0]] + ('至' + DZH[r[-1]] if len(r) > 2 else DZH[r[-1]] if len(r) == 2 else '')) for r in runs)
        de = ', '.join((DEN[r[0]] + ('–' + DEN[r[-1]] if len(r) > 2 else '–' + DEN[r[-1]] if len(r) == 2 else '')) for r in runs)
        if h == 'closed': zh.append(dz + '休'); en.append('closed ' + de)
        elif h == '24h': zh.append(dz + ' 24小时'); en.append(de + ' 24 h')
        else: zh.append(dz + ' ' + h.replace(',', '、')); en.append(de + ' ' + h.replace(',', ', '))
    return '；'.join(zh), '; '.join(en)
def closed_on_trip(days): return sorted(d for d, i in WEEKDAY.items() if days[i] == 'closed' and d != FLIGHT_DATE)  # trip dates it is shut (not the flight-only day)
def clean_addr(a):
    a = re.sub(r'^\d{3,6}', '', a or ''); a = a.replace('台灣', '', 1)
    return re.sub(r'(?<=[區鄉鎮市])[一-鿿]{1,3}里(?=[一-鿿])', '', a)
def nums(a): return set(re.findall(r'\d+(?:[之-]\d+)?號', a or ''))
def merge_addr(ours, g):
    g = clean_addr(g)
    if not g or (nums(ours) and nums(ours) == nums(g)): return ours
    paren = re.search(r'（[^）]*）$', ours or '')
    return g + (paren.group(0) if paren and paren.group(0) not in g else '')
