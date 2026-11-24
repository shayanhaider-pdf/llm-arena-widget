import unittest
from refresh import group

class TestHistory(unittest.TestCase):
    def test_week(self):
        def rows(date, a, b, cat="overall"):
            return [{"model_name":n,"rank":r,"category":cat,"leaderboard_publish_date":date} for n,r in [("A",a),("B",b)]]
        first = group(rows("2026-11-18",1,2),{},"2026-11-18")
        second = group(rows("2026-11-25",2,1),first,"2026-11-25")
        g=second["overall"]
        self.assertEqual(g["history"]["2026-11-18"],{"a":1,"b":2})
        self.assertEqual(g["history"]["2026-11-25"],{"a":2,"b":1})
        self.assertEqual(g["models"][0]["id"],"B")
        self.assertEqual(group(rows("2026-11-25",2,1),second,"2026-11-25"),second)
        self.assertEqual(group(rows("2026-11-18",1,2),second,"2026-11-26"),second)
        self.assertEqual(group(rows("2026-11-25",1,2,"coding"),{},"2026-11-25"),{})
        self.assertEqual(group(rows("2026-11-25",1,2,"math"),{},"2026-11-25"),{})
if __name__=="__main__":
    unittest.main()
