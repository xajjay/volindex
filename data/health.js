/* Written by tools/health_check.py. Do not edit by hand. */
window.SITE_HEALTH = {
 "checked": "2026-11-10",
 "counts": {
  "baseball": 57,
  "football": 12,
  "mbb": 34,
  "soccer": 18,
  "softball": 33,
  "volleyball": 27,
  "wbb": 33
 },
 "findings": [
  {
   "area": "manual",
   "level": "warn",
   "msg": "KenPom / Torvik / EvanMiya ratings last edited 28 days ago (check every 14). Refresh the basketball ratings."
  },
  {
   "area": "manual",
   "level": "warn",
   "msg": "Football depth chart last edited 21 days ago (check every 14). Re-check the depth chart after the latest game/injury news."
  },
  {
   "area": "manual",
   "level": "warn",
   "msg": "Volleyball lineup last edited 29 days ago (check every 21). Re-check the projected lineup."
  },
  {
   "area": "manual",
   "level": "warn",
   "msg": "Soccer lineup last edited 29 days ago (check every 21). Re-check the projected lineup."
  }
 ],
 "manual": [
  {
   "active": true,
   "ageDays": 20,
   "edited": "2026-10-21",
   "file": "data/recruiting.js",
   "label": "On3 / recruiting rankings",
   "maxDays": 30
  },
  {
   "active": true,
   "ageDays": 28,
   "edited": "2026-10-13",
   "file": "data/ratings-bb.js",
   "label": "KenPom / Torvik / EvanMiya ratings",
   "maxDays": 14
  },
  {
   "active": true,
   "ageDays": 21,
   "edited": "2026-10-20",
   "file": "data/football-depth.js",
   "label": "Football depth chart",
   "maxDays": 14
  },
  {
   "active": true,
   "ageDays": 0,
   "edited": "2026-11-10",
   "file": "data/mbb-lineup.js",
   "label": "Men's basketball lineup",
   "maxDays": 21
  },
  {
   "active": true,
   "ageDays": 5,
   "edited": "2026-11-05",
   "file": "data/wbb-lineup.js",
   "label": "Women's basketball lineup",
   "maxDays": 21
  },
  {
   "active": true,
   "ageDays": 29,
   "edited": "2026-10-12",
   "file": "data/volleyball-lineup.js",
   "label": "Volleyball lineup",
   "maxDays": 21
  },
  {
   "active": true,
   "ageDays": 29,
   "edited": "2026-10-12",
   "file": "data/soccer-lineup.js",
   "label": "Soccer lineup",
   "maxDays": 21
  },
  {
   "active": false,
   "ageDays": 25,
   "edited": "2026-10-16",
   "file": "data/baseball-lineup.js",
   "label": "Baseball lineup",
   "maxDays": 21
  },
  {
   "active": false,
   "ageDays": 29,
   "edited": "2026-10-12",
   "file": "data/softball-lineup.js",
   "label": "Softball lineup",
   "maxDays": 21
  }
 ],
 "ok": false,
 "sports": [
  {
   "ageDays": 0,
   "games": 12,
   "key": "football",
   "poll": null,
   "pollDate": null,
   "updated": "2026-11-10"
  },
  {
   "ageDays": 0,
   "games": 34,
   "key": "mbb",
   "poll": "AP Top 25",
   "pollDate": "2026-11-09",
   "updated": "2026-11-10"
  },
  {
   "ageDays": 0,
   "games": 33,
   "key": "wbb",
   "poll": "AP Top 25",
   "pollDate": "2026-11-09",
   "updated": "2026-11-10"
  },
  {
   "ageDays": 0,
   "games": 57,
   "key": "baseball",
   "poll": null,
   "pollDate": null,
   "updated": "2026-11-10"
  },
  {
   "ageDays": 0,
   "games": 33,
   "key": "softball",
   "poll": null,
   "pollDate": null,
   "updated": "2026-11-10"
  },
  {
   "ageDays": 0,
   "games": 27,
   "key": "volleyball",
   "poll": "AVCA Coaches Poll",
   "pollDate": "2026-11-08",
   "updated": "2026-11-10"
  },
  {
   "ageDays": 0,
   "games": 18,
   "key": "soccer",
   "poll": "United Soccer Coaches",
   "pollDate": "2026-11-03",
   "updated": "2026-11-10"
  }
 ],
 "warnings": 4
};
