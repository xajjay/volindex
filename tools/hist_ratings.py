"""Player ratings for the historical dynasty seasons, on the same scale as the 2026 game.

Every season is rated the same way, whatever the source:
  1. Each team gets a talent level for that year (its prestige slot), the same level the 2026 game uses to build a roster.
  2. Inside each position group players are ordered by merit: the source rating when there is one (NCAA 14 community
     rosters, EA College Football 25/26), what they produced that season, awards, class, and where they were drafted.
  3. Each spot on the depth chart gets the rating the 2026 game would give it for that talent level (starters high,
     backups lower, fourth-stringers well down), so a roster has real depth and real drop-offs.
  4. The stars get more on top: All-Americans, Heisman finalists, award winners, first-round picks.
Kickers and punters sit lower, like the 2026 game's.
"""
import math, re, zlib

STARTERS = {'QB': 1, 'RB': 1, 'WR': 3, 'TE': 1, 'OT': 2, 'IOL': 3, 'EDGE': 2, 'DT': 2, 'LB': 2, 'CB': 2, 'S': 2, 'K': 1, 'P': 1, 'LS': 1}
CLASS = {1: -5.5, 2: -2.0, 3: 0.0, 4: 1.5, 5: 2.0}
def norm(n): return re.sub(r'[^a-z]', '', re.sub(r'\b(jr|sr|ii|iii|iv|v)\b\.?', '', (n or '').lower()))
def jitter(name, y):
    return (zlib.crc32((name + str(y)).encode()) % 1000) / 1000 - 0.5

def slot_offset(pos, k):
    """Rating offset from the team level for the k-th player at a position (0 = best)."""
    s = STARTERS.get(pos, 1)
    if k < s: return 3.0 - k * 0.6                    # starters
    if k < 2 * s: return -1.5 - (k - s) * 0.5          # the two-deep
    return -4.5 - (k - 2 * s) * 2.2                    # everyone further down

def production(pos, st):
    """A 0-3ish production score for one season of stats (None when there are none)."""
    if not st: return None
    g = lambda k: float(st.get(k) or 0)
    if pos == 'QB':
        att = g('pass_att'); yds = g('pass_yds'); td = g('pass_td'); it = g('pass_int')
        if att < 40: return 0.2
        eff = (yds + 20 * td - 45 * it) / max(att, 1)
        return max(0, min(3.5, (att / 350) * 1.2 + (eff - 6.5) * 0.45 + g('rush_yds') / 1500))
    if pos in ('RB',):
        return max(0, min(3.5, g('rush_yds') / 650 + g('rush_td') / 14 + g('rec_yds') / 900))
    if pos in ('WR', 'TE'):
        return max(0, min(3.5, g('rec_yds') / 550 + g('rec_td') / 10 + (0.3 if pos == 'TE' else 0) * g('rec') / 30))
    if pos in ('EDGE', 'DT'):
        return max(0, min(3.5, g('sacks') / 5 + g('tackles_loss') / 9 + g('tackles_total') / 70))
    if pos == 'LB':
        return max(0, min(3.5, g('tackles_total') / 55 + g('tackles_loss') / 10 + g('sacks') / 6 + g('def_int') / 3))
    if pos in ('CB', 'S'):
        return max(0, min(3.5, g('def_int') / 2.5 + g('pass_defended') / 8 + g('tackles_total') / 80))
    if pos == 'K':
        fga = g('fga'); return 0 if fga < 5 else max(0, min(3, (g('fgm') / fga - 0.65) * 8 + fga / 25))
    if pos == 'P':
        n = g('punt'); return 0 if n < 10 else max(0, min(3, (g('punt_yds') / n - 39) / 2))
    return None

AWARD_W = [('H-1', 9), ('Heisman', 9), ('H-2', 6), ('H-3', 5), ('H-4', 4), ('H-5', 4), ('AA', 5), ('Maxwell', 5), ('Walker', 4), ('Bednarik', 5),
           ('Nagurski', 5), ('Outland', 5), ('Lombardi', 4), ('Butkus', 4), ('Thorpe', 4), ('Biletnikoff', 4), ('O\'Brien', 4), ('Groza', 3),
           ('Guy', 3), ('Mackey', 3), ('Rimington', 3), ('Camp', 4), ('Unitas', 3), ('Lott', 3)]
def award_points(aw):
    if not aw: return 0
    pts = 0
    for k, w in AWARD_W:
        if k in aw: pts = max(pts, w) + min(3, pts * 0.15)
    return pts

def draft_points(pick, years_out):
    """A later NFL draft pick, discounted by how many seasons away it was."""
    if not pick: return 0
    base = 7 if pick <= 10 else 5.5 if pick <= 32 else 4 if pick <= 64 else 3 if pick <= 100 else 2 if pick <= 160 else 1.2
    return base * max(0.25, 1 - (years_out - 1) * 0.3)

def rate_team(y, pr, rows, info):
    """rows: [name, pos, yr, src_ovr, ...]; info(name, pos) -> dict(src=0..1 or None, prod, aw, pick, yrs_out).
    Rewrites row[3] with the rating."""
    mu = 50.8 + 0.36 * pr
    by = {}
    for r in rows: by.setdefault(r[1], []).append(r)
    for pos, ps in by.items():
        scored = []
        srcs = [r[3] for r in ps if r[3]]
        m = sum(srcs) / len(srcs) if srcs else 0
        sd = (sum((v - m) ** 2 for v in srcs) / len(srcs)) ** 0.5 if len(srcs) > 1 else 6
        for r in ps:
            i = info(r[0], pos) or {}
            z = ((r[3] - m) / (sd or 6)) if r[3] else -0.6
            prod = i.get('prod')
            aw = award_points(i.get('aw'))
            dp = draft_points(i.get('pick'), i.get('yrs_out', 9))
            merit = z * 1.0 + (prod or 0) * 0.55 + aw * 0.25 + dp * 0.22 + CLASS.get(r[2], 0) * 0.08
            scored.append((merit, r, prod, aw, dp))
        scored.sort(key=lambda x: -x[0])
        for k, (merit, r, prod, aw, dp) in enumerate(scored):
            base = mu + slot_offset(pos, k) + CLASS.get(r[2], 0) * 0.5
            star = min(9, aw * 0.75 + dp * 0.45 + max(0, (prod or 0) - 1.6) * 1.6)     # the best players stand out
            o = base + star + jitter(r[0], y) * 2.5
            if pos in ('K', 'P'): o = mu - 8 + (3 if k == 0 else -3) + min(9, aw * 0.9 + (prod or 0) * 1.5) + jitter(r[0], y) * 2
            r[3] = int(max(45, min(99 if (aw >= 9 or (dp >= 7 and prod and prod > 2)) else 97, round(o))))
    return rows
