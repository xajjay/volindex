/* Written by tools/health_check.py. Do not edit by hand. */
window.SITE_HEALTH = {
 "checked": "2026-11-18",
 "counts": {
  "baseball": 57,
  "football": 12,
  "mbb": 34,
  "soccer": 19,
  "softball": 33,
  "volleyball": 28,
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
   "msg": "Volleyball lineup last edited 37 days ago (check every 21). Re-check the projected lineup."
  },
  {
   "area": "manual",
   "level": "warn",
   "msg": "Soccer lineup last edited 37 days ago (check every 21). Re-check the projected lineup."
  }
 ],
 "manual": [
  {
   "active": true,
   "ageDays": 7,
   "edited": "2026-11-11",
   "file": "data/recruiting.js",
   "label": "On3 / recruiting rankings",
   "maxDays": 30
  },
  {
   "active": true,
   "ageDays": 0,
   "edited": "2026-11-18",
   "file": "data/bb-ratings-manual.js",
   "label": "KenPom / Torvik / EvanMiya ratings",
   "maxDays": 14
  },
  {
   "active": true,
   "ageDays": 7,
   "edited": "2026-11-11",
   "file": "data/football-depth.js",
   "label": "Football depth chart",
   "maxDays": 14
  },
  {
   "active": true,
   "ageDays": 0,
   "edited": "2026-11-18",
   "file": "data/mbb-lineup.js",
   "label": "Men's basketball lineup",
   "maxDays": 21
  },
  {
   "active": true,
   "ageDays": 0,
   "edited": "2026-11-18",
   "file": "data/wbb-lineup.js",
   "label": "Women's basketball lineup",
   "maxDays": 21
  },
  {
   "active": true,
   "ageDays": 37,
   "edited": "2026-10-12",
   "file": "data/volleyball-lineup.js",
   "label": "Volleyball lineup",
   "maxDays": 21
  },
  {
   "active": true,
   "ageDays": 37,
   "edited": "2026-10-12",
   "file": "data/soccer-lineup.js",
   "label": "Soccer lineup",
   "maxDays": 21
  },
  {
   "active": false,
   "ageDays": 33,
   "edited": "2026-10-16",
   "file": "data/baseball-lineup.js",
   "label": "Baseball lineup",
   "maxDays": 21
  },
  {
   "active": false,
   "ageDays": 37,
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
   "updated": "2026-11-18"
  },
  {
   "ageDays": 0,
   "games": 34,
   "key": "mbb",
   "poll": "AP Top 25",
   "pollDate": "2026-11-16",
   "updated": "2026-11-18"
  },
  {
   "ageDays": 0,
   "games": 33,
   "key": "wbb",
   "poll": "AP Top 25",
   "pollDate": "2026-11-16",
   "updated": "2026-11-18"
  },
  {
   "ageDays": 0,
   "games": 57,
   "key": "baseball",
   "poll": null,
   "pollDate": null,
   "updated": "2026-11-18"
  },
  {
   "ageDays": 0,
   "games": 33,
   "key": "softball",
   "poll": null,
   "pollDate": null,
   "updated": "2026-11-18"
  },
  {
   "ageDays": 0,
   "games": 28,
   "key": "volleyball",
   "poll": "AVCA Coaches Poll",
   "pollDate": "2026-11-15",
   "updated": "2026-11-18"
  },
  {
   "ageDays": 0,
   "games": 19,
   "key": "soccer",
   "poll": "United Soccer Coaches",
   "pollDate": "2026-11-10",
   "updated": "2026-11-18"
  }
 ],
 "warnings": 2
};
