"""Test the production collector and the published data contract."""
import datetime as dt
import json
import pathlib
import tempfile
import unittest
from unittest.mock import patch
from refresh import group, collect_parquet, widget_feed, publish, valid_group, WIDGET_GROUPS

D1, D2 = '2026-10-25', '2026-11-25'
ROOT = pathlib.Path(__file__).parent

def row(name, rank, date=D2, cat='overall'):
    return {'model_name':name,'rank':rank,'category':cat,'leaderboard_publish_date':date}

def dataset():
    return json.loads((ROOT/'data/latest.json').read_text(encoding='utf-8'))

class TestRankings(unittest.TestCase):
    def test_month_history(self):
        first = group([row('A',1,D1),row('B',2,D1)],{},D1)
        second = group([row('A',2),row('B',1)],first,D2)
        g = second['overall']
        self.assertEqual(g['history'][D1],{'a':1,'b':2})
        self.assertEqual(g['history'][D2],{'a':2,'b':1})
        self.assertEqual(g['models'][0]['id'],'B')
        self.assertEqual(group([row('A',2),row('B',1)],second,D2),second)
        self.assertEqual(group([row('A',1,D1)],second,'2026-11-26'),second)

    def test_exclusions(self):
        self.assertEqual(group([row('A',1,cat=c) for c in ('math','mathematics')],{},D2),{})
        self.assertIn('code',group([row('A',1,cat='code')],{},D2))

    def test_duplicates(self):
        g=group([row('A',1),row('a',1),row('B',2),row('Unranked',None)],{},D2)['overall']
        self.assertEqual(g['models'],[{'id':'A','rank':1},{'id':'B','rank':2}])
        with self.assertRaises(ValueError):
            group([row('A',1),row('a',2)],{},D2)

    def test_bad_rows(self):
        for bad in (row(None,3),row('B',2.5),row('B',0),row('Future',2,'2026-11-26'),{'unexpected':True},row('__proto__',2)):
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                group([row('A',1),bad],{},D2)

    def test_missing_rank_one(self):
        with self.assertRaises(ValueError):
            group([row('B',2)],{},D2)

    def test_production_collector(self):
        with patch('refresh.parquet_rows',return_value=[row('A',1),row('B',2),row('A',1,cat='hard_prompts')]) as reader:
            result,errors=collect_parquet('text_style_control',[(0,1,'path')],'revision',{},D2)
        reader.assert_called_once_with([(0,1,'path')],'revision')
        self.assertEqual(result['groups']['overall']['sourceRevision'],'revision')
        self.assertIn('creative_writing',errors)
        self.assertEqual(len(result['groups']['overall']['models']),2)

    def test_missing_group_preserves_prior(self):
        old={'checked':D1,'groups':group([row('A',1,D1,cat='hard_prompts')],{},D1)}
        with patch('refresh.parquet_rows',return_value=[row('B',1)]):
            result,errors=collect_parquet('text_style_control',[],'revision',old,D2)
        self.assertEqual(result['groups']['hard_prompts'],old['groups']['hard_prompts'])
        self.assertIn('hard_prompts',errors)

    def test_complete_search_extends_matching_partial_snapshot(self):
        published = '2026-11-20'
        partial = group([row('A', 1, published)], {}, D2)['overall']
        partial['partial'] = True
        old = {'checked': D2, 'groups': {'overall': partial}}
        official_date = '2026-11-19'
        official = [row('A', 1, official_date), row('B', 2, official_date)]
        with patch('refresh.parquet_rows', return_value=official):
            result, errors = collect_parquet('search', [], 'revision', old, D2)
        complete = result['groups']['overall']
        self.assertEqual(complete['date'], official_date)
        self.assertEqual(complete['sourceRevision'], 'revision')
        self.assertFalse(complete['partial'])
        self.assertEqual(complete['totalModels'], 2)
        self.assertEqual(errors, {})

        for incompatible in (
            [row('B', 1, official_date), row('A', 2, official_date)],
            [row('A', 1, '2026-11-18'), row('B', 2, '2026-11-18')],
            official[:1],
        ):
            with self.subTest(official=incompatible), patch('refresh.parquet_rows', return_value=incompatible):
                result, errors = collect_parquet('search', [], 'revision', old, D2)
                self.assertEqual(result['groups']['overall'], partial)
                self.assertIn('overall', errors)

    def test_empty_source_rejected(self):
        with patch('refresh.parquet_rows',return_value=[]), self.assertRaises(ValueError):
            collect_parquet('search',[],'revision',{},D2)

    def test_real_feed_contract(self):
        data=dataset()
        compact=widget_feed(data)
        checked=json.loads((ROOT/'data/widget.json').read_text(encoding='utf-8'))
        expected={(s,k) for s,ks in WIDGET_GROUPS.items() for k in ks}
        self.assertEqual({(s,k) for s,v in checked['subsets'].items() for k in v['groups']},expected)
        for s,k in expected:
            g=compact['subsets'][s]['groups'][k]
            self.assertTrue(valid_group(g),(s,k))
            self.assertEqual(g['models'],checked['subsets'][s]['groups'][k]['models'],(s,k))

    def test_alignment_uses_own_source(self):
        data=dataset()
        published = data['subsets'].pop('agent_alignment')['groups']['overall']
        g=widget_feed(data)['subsets']['agent_alignment']['groups']['overall']
        self.assertFalse(g['partial'])
        self.assertEqual(g['source'],'https://arena.ai/leaderboard/agent/alignment')
        self.assertNotIn('sourceRevision', g)
        self.assertEqual(g['totalModels'], 68)
        self.assertEqual([m['rank'] for m in g['models']], list(range(1, 69)))
        self.assertEqual(len({m['id'].casefold() for m in g['models']}), 68)
        self.assertEqual(published, g)
        self.assertNotEqual(g['models'],data['subsets']['agent_capability']['groups']['overall']['models'])

        pinned = {**g, 'source': 'https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset', 'sourceRevision': 'revision'}
        data['subsets']['agent_alignment'] = {'checked': g['observed'], 'groups': {'overall': pinned}}
        self.assertEqual(widget_feed(data)['subsets']['agent_alignment']['groups']['overall'], pinned)

    def test_published_group_validation_matches_widget(self):
        g=group([row('A',1)],{},D2)['overall']
        self.assertTrue(valid_group(g,D2))
        for invalid in (
            {**g,'date':'20261125'},
            {**g,'partial':'false'},
            {**g,'models':[{'id':'__proto__','rank':1}]},
            {**g,'models':[{'id':'A','rank':1},{'id':'a','rank':2}]},
        ):
            with self.subTest(invalid=invalid):
                self.assertFalse(valid_group(invalid,D2))
        self.assertFalse(valid_group(g,D1))

    def test_checked_date_blocks_incompatible_feed(self):
        data=dataset()
        data['subsets']['search']['checked']='2020-01-01'
        with self.assertRaises(ValueError):
            widget_feed(data)

    def test_missing_required_group_blocks_publish(self):
        data=dataset()
        del data['subsets']['search']['groups']['overall']
        with tempfile.TemporaryDirectory() as folder:
            out=pathlib.Path(folder)/'latest.json'
            out.write_text('previous')
            with patch('refresh.OUT',out), self.assertRaises(ValueError):
                publish(data)
            self.assertEqual(out.read_text(),'previous')
            self.assertFalse((out.parent/'widget.json').exists())

    def test_publish_serializes_both(self):
        data=dataset()
        with tempfile.TemporaryDirectory() as folder:
            out=pathlib.Path(folder)/'latest.json'
            with patch('refresh.OUT',out):
                publish(data)
            self.assertEqual(json.loads(out.read_text()),data)
            self.assertEqual(json.loads((out.parent/'widget.json').read_text()),widget_feed(data))

    def test_registry_contract(self):
        reg=json.loads((ROOT/'data/access.json').read_text(encoding='utf-8'))
        self.assertEqual(reg['schemaVersion'],1)
        dt.date.fromisoformat(reg['reviewedAt'])
        seen=set()
        for p in reg['providers']:
            self.assertTrue(p['source'].startswith('https://'))
            self.assertTrue(p['url'].startswith('https://'))
            for m in p['models'] + p.get('codeModels',[]):
                key=(m['id'].strip().lower(),m.get('scope','chat'))
                self.assertNotIn(key,seen)
                seen.add(key)
                self.assertIn(m['status'],{'free','plus','reported_free','plus_candidate','unverified','paid'})
                self.assertIn(key[1],{'chat','work','code'})
                if m.get('expiresAt'):
                    dt.date.fromisoformat(m['expiresAt'])

if __name__=='__main__':
    unittest.main()
