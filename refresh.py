"""Publish public Arena rankings and retain daily rank snapshots."""
import datetime as dt
import json
import pathlib
import re
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

DATASET = "lmarena-ai/leaderboard-dataset"
API = "https://datasets-server.huggingface.co/"
OUT = pathlib.Path(__file__).parent / "data" / "latest.json"
SUBSETS = ("search_style_control", "text_style_control", "vision_style_control",
           "document_style_control", "webdev", "text_to_image", "image_edit",
           "text_to_video", "agent")

def norm(s):
    return re.sub(r"[^a-z0-9]+", "_", str(s).strip().lower()).strip("_")

def get(endpoint, **params):
    url = API + endpoint + "?" + urllib.parse.urlencode({"dataset": DATASET, **params})
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent":"Arena-widget/0.2"}), timeout=45) as response:
        return json.load(response)

def group(rows, previous, observed):
    groups = {}
    for row in rows:
        try:
            rank = int(row["rank"])
            name = row["model_name"]
            date = str(row["leaderboard_publish_date"])[:10]
            dt.date.fromisoformat(date)
            if rank < 1 or not name:
                continue
        except (KeyError, TypeError, ValueError):
            continue
        cat = norm(row.get("category") or "overall")
        if cat in {"coding", "math", "mathematics"}:
            continue
        if cat not in groups or date > groups[cat]["date"]:
            groups[cat] = {"date":date,"models":[]}
        if date == groups[cat]["date"]:
            groups[cat]["models"].append({"id":str(name),"rank":rank})
    cutoff = (dt.date.fromisoformat(observed)-dt.timedelta(days=14)).isoformat()
    for cat, g in list(groups.items()):
        old = previous.get(cat,{})
        if old.get("date","") > g["date"]:
            groups[cat] = old
            continue
        g["models"].sort(key=lambda m:(m["rank"],m["id"]))
        history = {d:r for d,r in old.get("history",{}).items() if d >= cutoff}
        history[observed] = {m["id"].strip().lower():m["rank"] for m in g["models"]}
        g["history"] = history
        g["observed"] = observed
    return groups

def fetch(subset, old, observed):
    rows, offset, total = [], 0, None
    while total is None or offset < total:
        result = get("rows",config=subset,split="latest",offset=offset,length=100)
        total,batch = result["num_rows_total"],result["rows"]
        if total > 20000 or not batch:
            raise ValueError("Unexpected or incomplete split")
        rows.extend(x["row"] for x in batch)
        offset += len(batch)
    groups = group(rows,old.get("groups",{}),observed)
    if not groups:
        raise ValueError("No ranked rows")
    return {"checked":observed,"groups":groups}

def main():
    previous = json.loads(OUT.read_text()) if OUT.exists() else {"subsets":{}}
    subsets = dict(previous.get("subsets",{}))
    now = dt.datetime.now(dt.timezone.utc)
    observed = now.date().isoformat()
    errors = {}
    available = {s["config"] for s in get("splits")["splits"] if s["split"]=="latest"}
    selected = [s for s in SUBSETS if s in available]
    if not selected:
        raise RuntimeError("No supported latest splits")
    with ThreadPoolExecutor(max_workers=3) as pool:
        jobs = {pool.submit(fetch,s,subsets.get(s,{}),observed):s for s in selected}
        for job in as_completed(jobs):
            s = jobs[job]
            try:
                subsets[s] = job.result()
            except Exception as e:
                errors[s] = str(e)
                print(s,e)
    if len(errors)==len(selected):
        raise RuntimeError("Every request failed; previous feed unchanged")
    data = {"source":DATASET,"generatedAt":now.isoformat(),"subsets":subsets,"errors":errors}
    OUT.parent.mkdir(exist_ok=True)
    temp = OUT.with_suffix(".tmp")
    temp.write_text(json.dumps(data,ensure_ascii=False,separators=(",",":")))
    temp.replace(OUT)
if __name__ == "__main__":
    main()
