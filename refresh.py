"""Collect public Arena data; publish only validated, complete snapshots."""
import datetime as dt
import json
import pathlib
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

DATASET = 'lmarena-ai/leaderboard-dataset'
API = 'https://datasets-server.huggingface.co/'
OUT = pathlib.Path(__file__).parent / 'data' / 'latest.json'
SUBSETS = {s: ('overall',) for s in ('search_style_control', 'vision_style_control',
    'document_style_control', 'webdev', 'text_to_image', 'image_edit', 'text_to_video', 'agent')}
SUBSETS['text_style_control'] = ('overall', 'hard_6', 'hard_prompts', 'creative_writing')

def norm(s):
    return re.sub(r'[^a-z0-9]+', '_', str(s).strip().lower()).strip('_')

def get(endpoint, **params):
    url = API + endpoint + '?' + urllib.parse.urlencode({'dataset': DATASET, **params})
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={'User-Agent':'Arena-widget/0.3'})
            with urllib.request.urlopen(req, timeout=30) as response:
                result = json.load(response)
            if not isinstance(result, dict) or result.get('error'):
                raise ValueError('Invalid API response')
            return result
        except (urllib.error.URLError, TimeoutError, ValueError) as exc:
            if isinstance(exc, urllib.error.HTTPError) and exc.code not in (408, 429, 500, 502, 503, 504):
                raise
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)

def group(rows, previous, observed):
    groups = {}
    for row in rows:
        try:
            rank = int(row['rank'])
            name = row['model_name']
            date = str(row['leaderboard_publish_date'])[:10]
            dt.date.fromisoformat(date)
            if rank < 1 or rank != float(row['rank']) or not isinstance(name, str) or not name.strip():
                continue
        except (KeyError, TypeError, ValueError, OverflowError):
            continue
        cat = norm(row.get('category') or 'overall')
        if cat in {'coding', 'math', 'mathematics'}:
            continue
        if cat not in groups or date > groups[cat]['date']:
            groups[cat] = {'date':date,'models':[]}
        if date == groups[cat]['date']:
            groups[cat]['models'].append({'id':name.strip(),'rank':rank})
    cutoff = (dt.date.fromisoformat(observed)-dt.timedelta(days=14)).isoformat()
    for cat, g in list(groups.items()):
        old = previous.get(cat,{})
        if old.get('date','') > g['date']:
            groups[cat] = old
            continue
        # Duplicate model IDs must not produce multiple ranking entries.
        unique = {}
        for m in sorted(g['models'],key=lambda m:(m['rank'],m['id'])):
            unique.setdefault(m['id'].lower(),m)
        g['models'] = list(unique.values())
        if g['models'][0]['rank'] != 1:
            raise ValueError('Missing rank one in '+cat)
        history = {d:r for d,r in old.get('history',{}).items() if d >= cutoff}
        history[observed] = {m['id'].lower():m['rank'] for m in g['models']}
        g['history'], g['observed'] = history, observed
    return groups

def fetch(subset, old, observed):
    rows, offset, total = [], 0, None
    cats = SUBSETS[subset]
    where = ' OR '.join('"category"=\''+c+'\'' for c in cats)
    while total is None or offset < total:
        result = get('filter',config=subset,split='latest',where=where,offset=offset,length=100)
        count, batch = result['num_rows_total'], result['rows']
        if not isinstance(count,int) or count < 1 or count > 20000 or not batch or (total is not None and count != total):
            raise ValueError('Unexpected or incomplete category response')
        total = count
        rows.extend(x['row'] for x in batch)
        offset += len(batch)
    if offset != total:
        raise ValueError('Row count mismatch')
    groups = group(rows,old.get('groups',{}),observed)
    if not groups or 'overall' not in groups:
        raise ValueError('No complete overall ranking')
    return {'checked':observed,'groups':{**old.get('groups',{}),**groups}}

def main():
    previous = json.loads(OUT.read_text()) if OUT.exists() else {'subsets':{}}
    subsets = dict(previous.get('subsets',{}))
    now = dt.datetime.now(dt.timezone.utc)
    observed = now.date().isoformat()
    errors = {}
    available = {s['config'] for s in get('splits')['splits'] if s['split']=='latest'}
    selected = [s for s in SUBSETS if s in available]
    if not selected:
        raise RuntimeError('No supported latest splits')
    for s in set(SUBSETS)-set(selected):
        errors[s] = 'Source subset unavailable'
    successes = 0
    with ThreadPoolExecutor(max_workers=3) as pool:
        jobs = {pool.submit(fetch,s,subsets.get(s,{}),observed):s for s in selected}
        for job in as_completed(jobs):
            s = jobs[job]
            try:
                subsets[s] = job.result()
                successes += 1
            except Exception as exc:
                errors[s] = str(exc)
                print(s, exc)
    if not successes:
        raise RuntimeError('Every request failed; previous feed unchanged')
    data = {'source':DATASET,'generatedAt':now.isoformat(),'subsets':subsets,'errors':errors}
    OUT.parent.mkdir(exist_ok=True)
    temp = OUT.with_suffix('.tmp')
    temp.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
    temp.replace(OUT)
if __name__ == '__main__':
    main()
