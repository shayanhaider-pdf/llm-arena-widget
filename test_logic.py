import unittest
from unittest.mock import patch
from refresh import group, fetch

D1, D2 = '2026-11-18', '2026-11-25'
def row(name, rank, date=D2, cat='overall'):
    return {'model_name':name,'rank':rank,'category':cat,'leaderboard_publish_date':date}

class TestRankings(unittest.TestCase):
    def test_week(self):
        first = group([row('A',1,D1),row('B',2,D1)],{},D1)
        second = group([row('A',2),row('B',1)],first,D2)
        g=second['overall']
        self.assertEqual(g['history'][D1],{'a':1,'b':2})
        self.assertEqual(g['history'][D2],{'a':2,'b':1})
        self.assertEqual(g['models'][0]['id'],'B')
        self.assertEqual(group([row('A',2),row('B',1)],second,D2),second)
        self.assertEqual(group([row('A',1,D1)],second,'2026-11-26'),second)
    def test_exclusions(self):
        self.assertEqual(group([row('A',1,cat='coding'),row('A',1,cat='math')],{},D2),{})
    def test_invalid_and_duplicate_rows(self):
        g=group([row('A',1),row('a',1),row('B',2),row(None,3),row('C',2.5),row('D',0)],{},D2)['overall']
        self.assertEqual(g['models'],[{'id':'A','rank':1},{'id':'B','rank':2}])
    def test_missing_rank_one(self):
        with self.assertRaises(ValueError): group([row('B',2)],{},D2)
    def test_pagination(self):
        with patch('refresh.get',side_effect=[{'num_rows_total':2,'rows':[{'row':row('A',1)}]},{'num_rows_total':2,'rows':[{'row':row('B',2)}]}]) as api:
            g=fetch('search_style_control',{},D2)
            self.assertEqual(len(g['groups']['overall']['models']),2)
            self.assertEqual(api.call_args_list[1].kwargs['offset'],1)
    def test_incomplete_page(self):
        with patch('refresh.get',side_effect=[{'num_rows_total':2,'rows':[{'row':row('A',1)}]},{'num_rows_total':2,'rows':[]}]):
            with self.assertRaises(ValueError): fetch('search_style_control',{},D2)
    def test_schema_change(self):
        with patch('refresh.get',return_value={'num_rows_total':1,'rows':[{'row':{'unexpected':True}}]}):
            with self.assertRaises(ValueError): fetch('search_style_control',{},D2)
    def test_reasoning_alias(self):
        with patch('refresh.get',return_value={'num_rows_total':2,'rows':[{'row':row('A',1)},{'row':row('B',1,cat='hard_6')}]}):
            g=fetch('text_style_control',{},D2)
            self.assertIn('hard_6',g['groups'])
if __name__=='__main__':
    unittest.main()
