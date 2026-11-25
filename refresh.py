"""Monthly ingestion of official Arena data. Retain last known valid groups on failure."""
import datetime as dt
import json
import math
import pathlib
import re
from concurrent.futures import ThreadPoolExecutor, as_completed

DATASET = 'lmarena-ai/leaderboard-dataset'
SOURCE = 'https://huggingface.co/datasets/' + DATASET
OUT = pathlib.Path(__file__).parent / 'data' / 'latest.json'

WIDGET_GROUPS = {
    'search': ('overall',),
    'text_style_control': ('overall','hard_prompts','creative_writing','instruction_following'),
    'agent_capability': ('overall','work','code','chat'),
    'agent_task_outcome': ('overall',),
    'agent_tool_efficiency': ('overall',),
    'agent_alignment': ('overall',),
    'vision_style_control': ('overall',),
    'document_style_control': ('overall',),
    'webdev': ('overall','image_to_webdev'),
    'text_to_image': ('overall',),
    'image_edit': ('overall','multi_image_edit'),
    'text_to_video': ('overall',),
    'image_to_video': ('overall',),
    'video_edit': ('overall',),
    'agent_steerability': ('overall',),
}


def norm(s):
    return re.sub(r'[^a-z0-9]+', '_', str(s).strip().lower()).strip('_')

def group(rows, previous, observed):
    dt.date.fromisoformat(observed)
    groups = {}
    for row in rows:
        if not isinstance(row,dict) or not {'rank','model_name','leaderboard_publish_date'}.issubset(row):
            raise ValueError('Missing Arena row fields')
        if row['rank'] is None:
            continue
        try:
            rank = int(row['rank'])
            name = row['model_name']
            date = str(row['leaderboard_publish_date'])[:10]
            dt.date.fromisoformat(date)
            if rank < 1 or rank != float(row['rank']) or not isinstance(name, str) or not name.strip() or date > observed or name.strip().lower() in {'__proto__','constructor','prototype'}:
                raise ValueError('Invalid ranked row')
        except (KeyError, TypeError, ValueError, OverflowError) as exc:
            raise ValueError('Invalid ranked row') from exc
        cat = norm(row.get('category') or 'overall')
        if cat in {'math', 'mathematics'}:
            continue
        if cat not in groups or date > groups[cat]['date']:
            groups[cat] = {'date':date,'models':[]}
        if date == groups[cat]['date']:
            model = {'id':name.strip(),'rank':rank}
            for field in ('rating','score','index_score','organization','license','vote_count','num_votes','votes','observation_count','session_count'):
                val = row.get(field)
                if isinstance(val, (str,int,float)) and (not isinstance(val,float) or math.isfinite(val)):
                    model[field] = val
            groups[cat]['models'].append(model)
    cutoff = (dt.date.fromisoformat(observed)-dt.timedelta(days=100)).isoformat()
    for cat, g in list(groups.items()):
        old = previous.get(cat,{})
        if old.get('date','') > g['date']:
            groups[cat] = old
            continue
        # Duplicate model IDs must not produce multiple ranking entries.
        unique = {}
        for m in sorted(g['models'],key=lambda m:(m['rank'],m['id'])):
            key = m['id'].lower()
            if key in unique and unique[key]['rank'] != m['rank']:
                raise ValueError('Conflicting ranks for '+m['id'])
            unique.setdefault(key,m)
        g['models'] = list(unique.values())
        if g['models'][0]['rank'] != 1:
            raise ValueError('Missing rank one in '+cat)
        history = {d:r for d,r in old.get('history',{}).items() if d >= cutoff}
        history[observed] = {m['id'].lower():m['rank'] for m in g['models']}
        g['history'], g['observed'] = history, observed
    return groups


def discover():
    """Resolve one immutable upstream revision for the entire collection."""
    from huggingface_hub import HfApi
    api = HfApi()
    revision = api.dataset_info(DATASET).sha
    if not revision:
        raise ValueError('No upstream revision')
    files = api.list_repo_files(DATASET, repo_type='dataset', revision=revision)
    by_subset = {}
    for p in files:
        match = re.fullmatch(r'([^/]+)/latest-(\d+)-of-(\d+)\.parquet',p)
        if match:
            sub, number, total = match.groups()
            by_subset.setdefault(sub,[]).append((int(number),int(total),p))
    return revision,by_subset

def parquet_rows(paths,revision):
    from huggingface_hub import hf_hub_download
    import pyarrow.parquet as pq
    expected = paths[0][1] if paths else 0
    if not expected or any(t!=expected for _,t,_ in paths) or sorted(n for n,_,_ in paths)!=list(range(expected)):
        raise ValueError('Incomplete official Parquet shards')
    rows = []
    for _,_,name in sorted(paths):
        local = hf_hub_download(DATASET,name,repo_type='dataset',revision=revision)
        rows.extend(pq.read_table(local).to_pylist())
    return rows

def collect_parquet(subset, paths, revision, old, observed):
    rows = parquet_rows(paths,revision)
    groups = group(rows,old.get('groups',{}),observed)
    if not groups:
        raise ValueError('No valid ranked rows')
    required = WIDGET_GROUPS.get(subset,())
    errors = {}
    for k in required:
        if k not in groups or groups[k].get('observed') != observed:
            errors[k] = 'Missing or older official group; retained previous snapshot'
    for g in groups.values():
        if g.get('observed') == observed and not g.get('partial'):
            g['source'] = SOURCE
            g['sourceRevision'] = revision
            g['partial'] = False
            g['totalModels'] = len(g['models'])
    return {'checked':observed,'groups':{**old.get('groups',{}),**groups}},errors

def canonical_date(value):
    if not isinstance(value,str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}',value):
        raise ValueError('Noncanonical date')
    return dt.date.fromisoformat(value)

def valid_group(g, checked=None):
    """Match the Scriptable client's accepted snapshot contract."""
    if not isinstance(g,dict) or not isinstance(g.get('models'),list) or not 0 < len(g['models']) <= 10000:
        return False
    if 'partial' in g and type(g['partial']) is not bool:
        return False
    try:
        date = canonical_date(g['date'])
        observed = canonical_date(g.get('observed',g['date']))
        today = dt.datetime.now(dt.timezone.utc).date()
        if not date <= observed <= today:
            return False
        if checked is not None and not observed <= canonical_date(checked) <= today:
            return False
        ids = [m['id'].strip().lower() for m in g['models']]
        ranks = [m['rank'] for m in g['models']]
        return (
            len(ids)==len(set(ids))
            and all(i and i not in {'__proto__','constructor','prototype'} for i in ids)
            and all(type(r) is int and r>0 for r in ranks)
            and 1 in ranks
        )
    except (KeyError,TypeError,ValueError,AttributeError):
        return False

def alignment_snapshot():
    """Fallback only: official website snapshot, not a substitute benchmark."""
    path = pathlib.Path(__file__).parent / 'data' / 'alignment.json'
    return json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}

def widget_feed(data):
    compact = {k:data[k] for k in ('source','generatedAt','errors')}
    compact['subsets'] = {}
    for subset,categories in WIDGET_GROUPS.items():
        current = data['subsets'].get(subset,{})
        if subset == 'agent_alignment':
            fallback = alignment_snapshot()
            official = current.get('groups',{}).get('overall',{})
            candidate = fallback.get('groups',{}).get('overall',{})
            if valid_group(candidate) and (not valid_group(official) or candidate['date'] > official['date']):
                current = fallback
            if current.get('groups',{}).get('overall',{}).get('partial'):
                compact['errors'] = {**compact['errors'], 'agent_alignment/overall':'Official website snapshot is partial; full downloadable split unavailable'}
        groups = {}
        for k in categories:
            g = current.get('groups',{}).get(k)
            if not current.get('checked') or not valid_group(g,current['checked']):
                raise ValueError('Missing or invalid required widget group: '+subset+'/'+k)
            groups[k] = g
        compact['subsets'][subset] = {'checked':current['checked'],'groups':groups}
    return compact

def publish(data):
    # Validate and serialize both files before replacing either. CI commits them together.
    compact = widget_feed(data)
    payloads = [(OUT,json.dumps(data,ensure_ascii=False,separators=(',',':'),allow_nan=False)),
                (OUT.parent/'widget.json',json.dumps(compact,ensure_ascii=False,separators=(',',':'),allow_nan=False))]
    OUT.parent.mkdir(exist_ok=True)
    for target,body in payloads:
        target.with_suffix('.tmp').write_text(body,encoding='utf-8')
    for target,_ in payloads:
        target.with_suffix('.tmp').replace(target)

def main():
    previous = json.loads(OUT.read_text(encoding='utf-8')) if OUT.exists() else {'subsets':{}}
    subsets = dict(previous['subsets'])
    fallback = alignment_snapshot()
    if 'agent_alignment' not in subsets and fallback:
        subsets['agent_alignment'] = fallback
    now = dt.datetime.now(dt.timezone.utc)
    observed = now.date().isoformat()
    revision,available = discover()
    # Collect only what the widget uses. Keep historical extra groups, but do not refresh unused scrapers.
    selected = sorted(set(WIDGET_GROUPS)&available.keys())
    errors = {s:'No official latest split; previous snapshot retained' for s in WIDGET_GROUPS if s not in available}
    successes = 0
    with ThreadPoolExecutor(max_workers=4) as pool:
        jobs = {pool.submit(collect_parquet,s,available[s],revision,subsets.get(s,{}),observed):s for s in selected}
        for job in as_completed(jobs):
            subset = jobs[job]
            try:
                result,missing = job.result()
                subsets[subset] = result
                if any(g.get('observed')==observed and g.get('sourceRevision')==revision for g in result['groups'].values()):
                    successes += 1
                for k,reason in missing.items():
                    errors[subset+'/'+k] = reason
            except Exception as exc:
                errors[subset] = str(exc)
                print(subset,exc)
    if not successes:
        raise RuntimeError('No official groups refreshed; prior feed unchanged')
    for subset,categories in WIDGET_GROUPS.items():
        for k in categories:
            g = subsets.get(subset,{}).get('groups',{}).get(k,{})
            if g.get('partial'):
                errors.setdefault(subset+'/'+k,'Partial prior snapshot; complete ranking unavailable')
    data = {'source':DATASET,'sourceRevision':revision,'generatedAt':now.isoformat(),'subsets':subsets,'errors':errors}
    publish(data)

if __name__ == '__main__':
    main()
