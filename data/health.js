/* Written by tools/health_check.py. Do not edit by hand. */
window.SITE_HEALTH = {
 "checked": "2026-11-25",
 "counts": {
  "baseball": 57,
  "football": 12,
  "mbb": 34,
  "soccer": 20,
  "softball": 49,
  "volleyball": 30,
  "wbb": 33
 },
 "findings": [
  {
   "area": "football",
   "level": "note",
   "msg": "Update step skipped: PEAR ratings: HTTP Error 403: Forbidden"
  },
  {
   "area": "manual",
   "level": "warn",
   "msg": "Volleyball lineup last edited 44 days ago (check every 21). Re-check the projected lineup."
  },
  {
   "area": "manual",
   "level": "warn",
   "msg": "Soccer lineup last edited 44 days ago (check every 21). Re-check the projected lineup."
  }
 ],
 "manual": [
  {
   "active": true,
   "ageDays": 7,
   "edited": "2026-11-18",
   "file": "data/recruiting.js",
   "label": "On3 / recruiting rankings",
   "maxDays": 30
  },
  {
   "active": true,
   "ageDays": 7,
   "edited": "2026-11-18",
   "file": "data/bb-ratings-manual.js",
   "label": "KenPom / Torvik / EvanMiya ratings",
   "maxDays": 14
  },
  {
   "active": true,
   "ageDays": 6,
   "edited": "2026-11-19",
   "file": "data/football-depth.js",
   "label": "Football depth chart",
   "maxDays": 14
  },
  {
   "active": true,
   "ageDays": 7,
   "edited": "2026-11-18",
   "file": "data/mbb-lineup.js",
   "label": "Men's basketball lineup",
   "maxDays": 21
  },
  {
   "active": true,
   "ageDays": 7,
   "edited": "2026-11-18",
   "file": "data/wbb-lineup.js",
   "label": "Women's basketball lineup",
   "maxDays": 21
  },
  {
   "active": true,
   "ageDays": 44,
   "edited": "2026-10-12",
   "file": "data/volleyball-lineup.js",
   "label": "Volleyball lineup",
   "maxDays": 21
  },
  {
   "active": true,
   "ageDays": 44,
   "edited": "2026-10-12",
   "file": "data/soccer-lineup.js",
   "label": "Soccer lineup",
   "maxDays": 21
  },
  {
   "active": false,
   "ageDays": 40,
   "edited": "2026-10-16",
   "file": "data/baseball-lineup.js",
   "label": "Baseball lineup",
   "maxDays": 21
  },
  {
   "active": false,
   "ageDays": 44,
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
   "updated": "2026-11-25"
  },
  {
   "ageDays": 0,
   "games": 34,
   "key": "mbb",
   "poll": "AP Top 25",
   "pollDate": "2026-11-23",
   "updated": "2026-11-25"
  },
  {
   "ageDays": 0,
   "games": 33,
   "key": "wbb",
   "poll": "AP Top 25",
   "pollDate": "2026-11-23",
   "updated": "2026-11-25"
  },
  {
   "ageDays": 0,
   "games": 57,
   "key": "baseball",
   "poll": null,
   "pollDate": null,
   "updated": "2026-11-25"
  },
  {
   "ageDays": 0,
   "games": 49,
   "key": "softball",
   "poll": null,
   "pollDate": null,
   "updated": "2026-11-25"
  },
  {
   "ageDays": 0,
   "games": 30,
   "key": "volleyball",
   "poll": "AVCA Coaches Poll",
   "pollDate": "2026-11-22",
   "updated": "2026-11-25"
  },
  {
   "ageDays": 0,
   "games": 20,
   "key": "soccer",
   "poll": "United Soccer Coaches",
   "pollDate": "2026-11-10",
   "updated": "2026-11-25"
  }
 ],
 "warnings": 2
};
