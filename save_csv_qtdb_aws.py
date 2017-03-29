"""
deltaQT Database - Save Partial Database, Updated March 28,2017

Copyright (C) 2017, Tatonetti Lab
Tal Lorberbaum <tal.lorberbaum@columbia.edu>
Victor Nwankwo <vtn2106@cumc.columbia.edu>
Nicholas P. Tatonetti <nick.tatonetti@columbia.edu>
All rights reserved.

This script is released under a CC BY-NC-SA 4.0 license.
For full license details see LICENSE.txt or go to:
http://creativecommons.org/licenses/by-nc-sa/4.0/

------------------------------------------------------------------------
deltaQT Database script for saving selected drugs to CSV.
See www.deltaqt.org for more information about the database.
"""

import pymysql

def gen_partial_db(drugs):
    # Connect to the database
    conn = pymysql.connect(read_default_file='CONFIG_FILE',
                db='qtdb',
                charset='utf8mb4',
                cursorclass=pymysql.cursors.DictCursor)
    cur = conn.cursor()

    table_suffix = ""

    if len(drugs) == 1:
        if drugs[0].startswith('('):
            drug_select = 'in'
        else:
            drug_select = '='

        SQL = '''select pm.pt_id_era, pm.pt_id #, pm.age, pm.sex, pm.race, pm.num_drugs, pm.pre_qt_500, pm.post_qt_500, pm.delta_qt
from qtdb.Patient{suffix} pm
join
    (select pt_id, 
     max(delta_qt) as max_delta
     from qtdb.Patient{suffix} p
     join qtdb.Patient2Drug{suffix} d1 using (pt_id_era)
     where d1.drug_concept_id {drug_select} {drugs0}\n'''.format(suffix=table_suffix, drug_select=drug_select, drugs0=drugs[0])


    else:
        SQL = '''select pm.pt_id_era, pm.pt_id #, pm.age, pm.sex, pm.race, pm.num_drugs, pm.pre_qt_500, pm.post_qt_500, pm.delta_qt
from qtdb.Patient{suffix} pm
join
    (select pt_id, 
     max(delta_qt) as max_delta
     from qtdb.Patient{suffix} p\n'''.format(suffix=table_suffix)

        for i in range(len(drugs)):
            SQL += '''     join qtdb.Patient2Drug%s d%d using (pt_id_era)\n''' %(table_suffix, (i+1))


        for i in range(len(drugs)):
            if i == 0:
                where_statement = 'where'
            else:
                where_statement = 'and'

            if drugs[i].startswith('('):
                drug_select = 'in'
            else:
                drug_select = '='

            SQL += '''     %s d%d.drug_concept_id %s %s\n''' %(where_statement, i+1, drug_select, drugs[i])

    delta_limit = 150
    SQL += '''     and abs(delta_qt) <= %d\n''' %delta_limit

    SQL += '''     group by pt_id) m
on pm.pt_id = m.pt_id
and pm.delta_qt = m.max_delta;'''

    print SQL
    cur.execute(SQL)
    results = cur.fetchall()

    pt_ids_seen = set()
    pt_id_eras = []

    for result in results:
        if result['pt_id'] in pt_ids_seen:
            continue
        pt_ids_seen.add(result['pt_id'])
        pt_id_eras.append(str(result['pt_id_era']))

    print len(pt_id_eras),"results to write to CSV"
    # print pt_id_eras
    
    if len(pt_id_eras) > 10000:
        return "Too many patients"

    # Query to get all data
    SQL = '''select pt_id_era, pt_id, era, age, sex, race, num_drugs, drug_concept_id, drug_name, pre_qt_500, post_qt_500, delta_qt
from Patient
join Patient2Drug using (pt_id_era)
join Drug using (drug_concept_id)
where pt_id_era in %s
#order by pt_id_era;''' %str(tuple(pt_id_eras))
    
    cur.execute(SQL)
    results = cur.fetchall()

    header = ['pt_id_era', 'pt_id', 'era', 'age', 'sex', 'race', 'num_drugs', 'drug_concept_id', 'drug_name', 'pre_qt_500', 'post_qt_500', 'delta_qt']
    
    partial_db = []
    partial_db.append(header)

    for result in results:
        partial_db.append([str(result[key]) for key in header])

    cur.close()
    conn.close()

    # Adapted from http://stackoverflow.com/a/898404
    partial_csv = "\n".join(",".join('"'+str(element)+'"' for element in line) for line in partial_db)

    return partial_csv