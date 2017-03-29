"""
deltaQT Database - Application, Updated March 28,2017

Copyright (C) 2017, Tatonetti Lab
Tal Lorberbaum <tal.lorberbaum@columbia.edu>
Victor Nwankwo <vtn2106@cumc.columbia.edu>
Nicholas P. Tatonetti <nick.tatonetti@columbia.edu>
All rights reserved.

This script is released under a CC BY-NC-SA 4.0 license.
For full license details see LICENSE.txt or go to:
http://creativecommons.org/licenses/by-nc-sa/4.0/

------------------------------------------------------------------------
deltaQT Database application script
See www.deltaqt.org for more information about the database.
"""

from bottle import default_app, route, static_file, request, response

import pymysql
import query_qtdb_aws
import save_csv_qtdb_aws


@route('/')
def index():
    return static_file("qtdb.html", root='')

@route('/faq')
def faq():
    return static_file("faq.html", root='')

@route('/index/css/<cssfile>')
def static_css(cssfile):
    return static_file(cssfile, root='index/css/')

@route('/index/img/<imgfile>')
def static_img(imgfile):
    return static_file(imgfile, root='index/img/')

@route('/index/fonts/<fontfile>')
def static_font(fontfile):
    return static_file(fontfile, root='index/fonts/')

@route('/index/js/<jsfile>')
def static_js(jsfile):
    return static_file(jsfile, root='index/js/')

@route('/index/csv/<csvfile>')
def static_csv(csvfile):
    return static_file(csvfile, root='index/csv/')

@route('/api/v1/query')
def api_call():
    splitstr = request.params.get('drugs')

    drugs = [drug.replace('|',',') for drug in splitstr.split(',')]
    print "Drugs:",drugs

    if drugs == ['']:
        response.status = 400
        return 'No drugs selected'
    elif len(drugs) == 1:
        delta_qts = query_qtdb_aws.query_db(drugs)
        
        json = '''{"delta_qts": %s}''' %(str(delta_qts))
    else:
        print "Caching", drugs[-1]
        delta_qts, delta_qts_cache = query_qtdb_aws.query_db(drugs, cache=True)

        json = '''{"delta_qts": %s,
                   "cache_%s": %s}''' %(str(delta_qts), drugs[-1].replace(',','|'), str(delta_qts_cache))

    json = json.replace("'", '"')
    # print json

    response.content_type = 'application/json'

    return json


@route('/api/v1/csv')
def api_call_csv():
    splitstr = request.params.get('drugs')
    drugs = [drug.replace('|',',') for drug in splitstr.split(',')]
    print drugs

    partial_csv = save_csv_qtdb_aws.gen_partial_db(drugs)

    if partial_csv == "Too many patients":
        response.status = 413 # Payload Too Large
        response.content_type = 'text/plain'
        return partial_csv
    else:
        response.content_type = 'text/csv'
        response.headers['Content-Disposition'] = 'attachment; filename="qtdb_subset.csv"'

        return partial_csv


application = default_app()

if __name__ == '__main__':
    application.run(host='0.0.0.0') #, debug=True)
