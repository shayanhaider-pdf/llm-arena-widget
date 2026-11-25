"""Collect public Arena data; publish only validated, complete snapshots."""
import datetime as dt
import json
import io
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
SUBSETS = {s: ('overall',) for s in ('search', 'search_style_control', 'vision_style_control',
    'document_style_control', 'webdev', 'text_to_image', 'image_edit', 'text_to_video', 'image_to_video', 'video_edit', 'agent', 'agent_index', 'work', 'alignment')}
SUBSETS['text_style_control'] = ('overall', 'hard_6', 'hard_prompts', 'creative_writing', 'instruction_following')

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
            model = {'id':name.strip(),'rank':rank}
            for field in ('rating','score','organization','license','num_votes','votes','observation_count','session_count'):
                val = row.get(field)
                if isinstance(val, (str,int,float)) and (not isinstance(val,float) or __import__('math').isfinite(val)):
                    model[field] = val
            groups[cat]['models'].append(model)
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
        if result.get('partial') is True or not isinstance(count,int) or count < 1 or count > 20000 or not batch or (total is not None and count != total):
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

def parquet_rows(subset):
    """Read the original published artifact rather than the filtered viewer API."""
    from huggingface_hub import HfApi, hf_hub_download
    import pyarrow.parquet as pq
    files = HfApi().list_repo_files(DATASET, repo_type='dataset')
    paths = sorted(p for p in files if p.startswith(subset + '/latest-') and p.endswith('.parquet'))
    if not paths:
        raise ValueError('No official latest Parquet split: '+subset)
    rows = []
    for p in paths:
        path = hf_hub_download(DATASET, p, repo_type='dataset')
        rows.extend(pq.read_table(path).to_pylist())
    return rows

def collect_parquet(subset, old, observed):
    rows = parquet_rows(subset)
    groups = group(rows,old.get('groups',{}),observed)
    if not groups:
        raise ValueError('No valid ranking groups')
    for k,g in groups.items():
        if g.get('observed') == observed and not g.get('partial'):
            g['source'] = 'https://huggingface.co/datasets/'+DATASET
            g['partial'] = False
            g['totalModels'] = len(g['models'])
    return {'checked':observed,'groups':{**old.get('groups',{}),**groups}}

INDEX_PAGES = {
    'work': 'https://arena.ai/leaderboard/agent/work',
    'agent_index': 'https://arena.ai/leaderboard/agent',
}
INDEX_NAMES = {
    'work': 'Work Index',
    'agent_index': 'Agent Arena',
}

def parse_index_rows(raw_rows, publication, source):
    """Normalize explicit rank/model/score cells from an Arena model table."""
    out = {}
    for rank_text, name, score_text in raw_rows:
        rank_text = rank_text.strip().lstrip('#')
        if not re.fullmatch(r'\d+', rank_text):
            continue
        rank = int(rank_text)
        name = name.strip()
        if rank < 1 or not name or not re.search(r'[A-Za-z]',name):
            continue
        if rank in out and out[rank]['model_name'] != name:
            raise ValueError('Conflicting rank '+str(rank))
        m = {'model_name':name, 'rank':rank, 'category':'overall', 'leaderboard_publish_date':publication}
        score = re.match(r'\s*([\d,]+(?:\.\d+)?)',score_text)
        if score:
            m['rating'] = float(score.group(1).replace(',',''))
        out[rank] = m
    if not set(range(1,21)).issubset(out):
        raise ValueError('Official index did not expose a complete top 20')
    if len({m['model_name'].lower() for m in out.values()}) != len(out):
        raise ValueError('Duplicate model rows')
    return [out[k] for k in sorted(out)]

def collect_web_index(key, old, observed):
    """Work/new Agent Index are different from the historical agent subset."""
    from playwright.sync_api import sync_playwright
    source = INDEX_PAGES[key]
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            page = browser.new_page(viewport={'width':1440,'height':1000})
            response = page.goto(source,wait_until='domcontentloaded',timeout=45000)
            if not response or response.status >= 400:
                raise ValueError('Arena page unavailable')
            heading = page.get_by_text(INDEX_NAMES[key],exact=False).first
            heading.wait_for(timeout=20000)
            body = page.locator('body').inner_text(timeout=15000)
            if INDEX_NAMES[key].lower() not in body.lower():
                raise ValueError('Wrong Arena index')
            date_match = re.search(r'\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}, 20\d{2}\b',body)
            if not date_match:
                raise ValueError('Publication date not visible')
            publication = dt.datetime.strptime(date_match.group(),'%b %d, %Y').date().isoformat()
            # Explicitly request the expanded rankings if the chart limits the preview.
            button = page.get_by_role('button',name='View all',exact=False).first
            if button.count() and button.is_visible():
                button.click(timeout=5000)
                page.wait_for_timeout(1500)
            tables = page.locator('table,[role=table],[role=grid]')
            found = []
            for i in range(tables.count()):
                table = tables.nth(i)
                if not table.is_visible():
                    continue
                headings = table.locator('thead th,[role=columnheader]').all_inner_texts()
                h = [x.strip().lower() for x in headings]
                if 'rank' not in h or not any(x == 'model' or x.startswith('model ') for x in h):
                    continue
                ri = h.index('rank')
                mi = next(i for i,x in enumerate(h) if x=='model' or x.startswith('model '))
                si = next((i for i,x in enumerate(h) if x in ('score','index','rating')),None)
                rows = []
                tr = table.locator('tbody tr,[role=row]')
                for n in range(tr.count()):
                    cells = tr.nth(n).locator('td,[role=cell],[role=gridcell]')
                    if cells.count() <= max(ri,mi):
                        continue
                    model = cells.nth(mi)
                    # Model cell's first visible line is the public model label.
                    name = model.inner_text().splitlines()[0].strip()
                    rows.append((cells.nth(ri).inner_text(),name,cells.nth(si).inner_text() if si is not None and cells.count()>si else ''))
                try:
                    found.append(parse_index_rows(rows,publication,source))
                except ValueError:
                    continue
            if not found:
                raise ValueError('No validated top-20 model table after expansion')
            rows = max(found,key=len)
            g = group(rows,old.get('groups',{}),observed)['overall']
            if g['date'] == publication:
                g['source'] = source
                # UI may paginate; the first 20 are validated, not necessarily all rows.
                g['partial'] = True
                g['top20Complete'] = True
                g['totalModels'] = len(g['models'])
            return {'checked':observed,'groups':{'overall':g}}
        finally:
            browser.close()

def main():
    previous = json.loads(OUT.read_text()) if OUT.exists() else {'subsets':{}}
    subsets = dict(previous.get('subsets',{}))
    now = dt.datetime.now(dt.timezone.utc)
    observed = now.date().isoformat()
    errors = {}
    successes = 0
    # Discover official subsets through the repository itself, not the viewer.
    from huggingface_hub import HfApi
    try:
        files = HfApi().list_repo_files(DATASET, repo_type='dataset')
    except Exception as exc:
        files = []
        errors['dataset'] = str(exc)
    available = {p.split('/')[0] for p in files if '/latest-' in p and p.endswith('.parquet')}
    selected = sorted(s for s in available if s in SUBSETS or s.startswith('agent_'))
    if not selected:
        print('No official latest splits; attempting index pages')
    with ThreadPoolExecutor(max_workers=4) as pool:
        jobs = {pool.submit(collect_parquet,s,subsets.get(s,{}),observed):s for s in selected}
        for job in as_completed(jobs):
            s = jobs[job]
            try:
                subsets[s] = job.result()
                successes += 1
            except Exception as exc:
                errors[s] = str(exc)
                print(s, exc)
    # Use the new official index pages when no matching downloadable split is available.
    for key in INDEX_PAGES:
        existing = subsets.get(key,{}).get('groups',{}).get('overall',{})
        if key in selected and not existing.get('partial') and existing.get('observed') == observed:
            continue
        try:
            subsets[key] = collect_web_index(key,subsets.get(key,{}),observed)
            successes += 1
            errors.pop(key,None)
        except Exception as exc:
            errors[key] = str(exc)
            print(key, exc)
    for required in ('search','text_style_control','vision_style_control','document_style_control'):
        if required not in selected:
            errors[required] = 'No matching official Parquet split; earlier snapshot retained'
    if not successes:
        raise RuntimeError('All official file requests failed; prior feed unchanged')
    data = {'source':DATASET,'generatedAt':now.isoformat(),'subsets':subsets,'errors':errors}
    OUT.parent.mkdir(exist_ok=True)
    temp = OUT.with_suffix('.tmp')
    temp.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'),allow_nan=False))
    temp.replace(OUT)
if __name__ == '__main__':
    main()
