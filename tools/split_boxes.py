"""Deploy step: move the big box-score tables out of each sport's data/<key>-auto.js into data/<key>-box.js,
so every page loads ~1.5 MB less. The page loads a sport's box file only when someone opens a box score
(assets/sports.js, openBoxSport). Run on the packaged site folder: python tools/split_boxes.py _site"""
import json, os, re, sys
site = sys.argv[1] if len(sys.argv) > 1 else "_site"
saved = 0
for key in ["volleyball", "soccer", "mbb", "wbb", "baseball", "softball"]:
    path = os.path.join(site, "data", f"{key}-auto.js")
    if not os.path.exists(path): continue
    text = open(path, encoding="utf-8").read()
    m = re.search(r"window\.SITE_AUTO\['" + key + r"'\] = (.*);\s*$", text, re.S)
    if not m: continue
    data = json.loads(m.group(1))
    box = data.pop("box", None)
    if not box: continue
    data["boxIds"] = sorted(box.keys()); data["boxFile"] = f"{key}-box.js"
    head = text[:m.start(1)]
    new = head + json.dumps(data, separators=(",", ":"), ensure_ascii=False) + ";\n"
    open(path, "w", encoding="utf-8").write(new)
    open(os.path.join(site, "data", f"{key}-box.js"), "w", encoding="utf-8").write(
        f"/* Box scores for {key}, split from {key}-auto.js at deploy (tools/split_boxes.py). */\nwindow.SITE_BOX = window.SITE_BOX || {{}};\nwindow.SITE_BOX['{key}'] = " + json.dumps(box, separators=(",", ":"), ensure_ascii=False) + ";\n")
    saved += len(text) - len(new)
print(f"split box scores: {saved // 1024} KB less on every page load")
