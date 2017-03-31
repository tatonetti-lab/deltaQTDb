"""
deltaQT Database creation script, Updated March 28, 2017

Copyright (C) 2017, Tatonetti Lab
Tal Lorberbaum <tal.lorberbaum@columbia.edu>
Nicholas P. Tatonetti <nick.tatonetti@columbia.edu>
All rights reserved.

This script is released under a CC BY-NC-SA 4.0 license.
For full license details see LICENSE.txt or go to:
http://creativecommons.org/licenses/by-nc-sa/4.0/

------------------------------------------------------------------------
Creates deltaQT Database by connecting to OMOP Common Data Model and a
local database of heart-rate corrected QT (QTc) intervals.
See www.deltaqt.org for more information about the database.
"""


import MySQLdb
from collections import defaultdict
import numpy as np
import random
import operator
import csv

from tqdm import tqdm

# Define table names
CONFIG_FILE = ""  # log-in credentials for database
OMOP_CDM_DB = ""  # local OMOP CDM MySQL database
DRUG_ERA = ""     # local OMOP CDM DRUG_ERA table
CONCEPT  = ""     # local OMOP CDM CONCEPT table
PERSON   = ""     # local OMOP CDM PERSON table
ECG_QTC  = ""     # local ECG table (see line 146)

print "Creating deltaQT Database..."

# Connect to MySQL database
print "Connecting to database"
con = MySQLdb.connect(read_default_file = CONFIG_FILE, db = OMOP_CDM_DB)
cur = con.cursor()



# Get drug names
print "Getting commonly prescribed drugs:",
min_num_pts = 3000

drug2name = dict()
drugname2concept_id = dict()

SQL = '''select * from
        (select drug_concept_id, concept_name as drug, count(distinct person_id) as num_pts
        from {DRUG_ERA} de
        join {CONCEPT} c on (c.concept_id = de.drug_concept_id)
        where concept_name not like '%%vaccine%%'
        group by drug_concept_id
        order by num_pts desc) d

        where num_pts > {min_num_pts};'''.format(DRUG_ERA=DRUG_ERA, CONCEPT=CONCEPT, min_num_pts=min_num_pts)
cur.execute(SQL)
results = cur.fetchall()

for concept_id, drugname, num_pts in results:
    concept_id = int(concept_id)
    drugname = drugname.lower()
    drug2name[concept_id] = drugname
    drugname2concept_id[drugname] = concept_id
print len(drug2name), "drugs selected"



# Get demographic information for patients on top drugs
print "Getting demographic information for patients on top drugs:",
pt2sex = dict()
pt2race = dict()
pt2bday = dict()

SQL = '''
select distinct person_source_value, gender_source_value, race_source_value,
convert(concat(cast(year_of_birth as CHAR), '-', cast(month_of_birth as CHAR), '-', cast(day_of_birth as CHAR)), date) as bday
from clinical_cumc.DRUG_ERA de
join clinical_cumc.PERSON p using (person_id)
where drug_concept_id in {selected_drugs}
and gender_source_value in ('M','F')
and datediff(drug_era_start_date, convert(concat(cast(year_of_birth as CHAR), '-', cast(month_of_birth as CHAR), '-', cast(day_of_birth as CHAR)), date))/365.25 >= 18
and datediff(drug_era_start_date, convert(concat(cast(year_of_birth as CHAR), '-', cast(month_of_birth as CHAR), '-', cast(day_of_birth as CHAR)), date))/365.25 <= 89;'''.format( DRUG_ERA=DRUG_ERA, PERSON=PERSON, selected_drugs=str(tuple(drug2name.keys())) )
cur.execute(SQL)
results = cur.fetchall()

for person_id, sex, race, bday in results:
    pt2sex[person_id] = sex
    if race not in ('W', 'B'):
        race = 'O'
    pt2race[person_id] = race
    pt2bday[person_id] = bday

print len(pt2sex), "patients found"

# Get all Rx for all patients on top drugs
print "Getting prescriptions for patients on top drugs (this may take a while)"
pt2era = defaultdict(dict)

for drug_concept_id in tqdm(drug2name.keys()):
    SQL = '''
select person_source_value, drug_era_start_date, drug_era_end_date
from {DRUG_ERA} de
join {PERSON} p using (person_id)
where drug_concept_id = {drug_concept_id}
and gender_source_value in ('M','F')
and datediff(drug_era_start_date, convert(concat(cast(year_of_birth as CHAR), '-', cast(month_of_birth as CHAR), '-', cast(day_of_birth as CHAR)), date))/365.25 >= 18
and datediff(drug_era_start_date, convert(concat(cast(year_of_birth as CHAR), '-', cast(month_of_birth as CHAR), '-', cast(day_of_birth as CHAR)), date))/365.25 <= 89;'''.format( DRUG_ERA=DRUG_ERA, PERSON=PERSON, drug_concept_id=drug_concept_id)

    num_results = cur.execute(SQL)

    for i in range(num_results):
        person_id, start_date, end_date = cur.fetchone()
                
        if drug_concept_id not in pt2era[person_id]:
            pt2era[person_id][drug_concept_id] = []
        
        pt2era[person_id][drug_concept_id].append((start_date, end_date))

print len(pt2era), "patients on selected drugs"



# Confirm drug exposures aren't completely encapsulated by another exposure to same drug
print "Removing redundant drug exposures"
for person_id in tqdm(pt2era.keys()):
    for drug_concept_id in pt2era[person_id]:
        if len(pt2era[person_id][drug_concept_id]) > 1:
            prev_start = ''
            prev_end = ''

            for entry in sorted(pt2era[person_id][drug_concept_id]):
                if prev_start != '' and entry[0] > prev_start and entry[1] <= prev_end:
                    pt2era[person_id][drug_concept_id].remove(entry)

                prev_start = entry[0]
                prev_end = entry[1]



# Get ECGs
print "Getting all ECGs"
pt2qtc = defaultdict(list)

# QT ranges from https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3940069/
SQL = '''select distinct mrn,date(datetime),qtc,gender_source_value
        from {ECG_QTC} qt
        join {PERSON} p on (p.person_source_value = qt.mrn)
        where qtc >= 360 and qtc <= 800
        and mrn in (select distinct person_source_value
                    from {PERSON}
                    join {DRUG_ERA} using (person_id))
        and mrn != 0
        order by mrn,datetime'''.format(ECG_QTC=ECG_QTC, PERSON=PERSON, DRUG_ERA=DRUG_ERA)
num_results = cur.execute(SQL)
results = cur.fetchall()

for mrn,ecgdate,qtc,sex in tqdm(results):
    if sex in ['M','F']:
        pt2qtc[mrn].append((ecgdate,int(qtc)))
    
print len(pt2qtc), "patients with ECGs"



# Group ECGs into eras
print "Grouping ECGs into eras"
pt2ecg_era = dict()

for pt in tqdm(pt2qtc.keys()):
    if pt == 0 or len(pt2qtc[pt]) == 1:
        continue

    pt2ecg_era[pt] = defaultdict(list)

    buffer_date = pt2qtc[pt][0][0]
    era_num = 1
    for (ecgdate,qtc) in pt2qtc[pt]:
        if (ecgdate-buffer_date).days <= 36:
            pt2ecg_era[pt][era_num].append((ecgdate,qtc))
            buffer_date = ecgdate
        else:
            buffer_date = ecgdate
            era_num += 1
            pt2ecg_era[pt][era_num] = [(ecgdate,qtc)]



# Calculate baseline for each patient (global median)
print "Calculating baseline QTc interval for each patient"
pt2baseline = dict()

for pt in tqdm(pt2ecg_era):
    if pt not in pt2sex:
        continue
    
    qtc_arr = []
    for (ecgdate,qtc) in pt2qtc[pt]:
        qtc_arr.append(qtc)
    median_qtc = np.median(qtc_arr)
    pt2baseline[pt] = median_qtc
    
print len(pt2baseline), "baselines calculated"



# Get max(ecgdate,qtc) per era (including era of length 1)
print "Collecting maxECG per ECG era"
pt2max_ecg_era = defaultdict(dict)

for pt in tqdm(pt2ecg_era):
    if pt not in pt2sex:
        continue
    
    for era_num in pt2ecg_era[pt]:
        if len(pt2ecg_era[pt][era_num]) == 1:
            (ecgdate,qtc) = pt2ecg_era[pt][era_num][0]
            pt2max_ecg_era[pt][era_num] = (ecgdate,qtc)
            
        else:
            max_qt = 0
            max_ecgdate = ''
            for (ecgdate,qtc) in pt2ecg_era[pt][era_num]:
                if qtc > max_qt:
                    max_qt = qtc
                    max_ecgdate = ecgdate
            pt2max_ecg_era[pt][era_num] = (max_ecgdate,max_qt)



# Collect drug exposures leading up to max(ecgdate,qtc)
print "Collecting drug exposures leading up to maxECG date in ECG era"
pt2qtdb = dict()

for pt in tqdm(pt2max_ecg_era):
    pt2qtdb[pt] = defaultdict(list)
    
    pre_qt = pt2baseline[pt]
    
    for era_num in sorted(pt2max_ecg_era[pt].keys()):
        (post_ecg_date, post_qt) = pt2max_ecg_era[pt][era_num]
        
        # Find drug exposures leading up to ECG date
        # drug_start_date-----post_ECG-------drug_end_date
        # drug_start_date---drug_end_date---36d---post_ECG
        for drug_concept_id in pt2era[pt]:
            for (drug_start_date, drug_end_date) in pt2era[pt][drug_concept_id]:
                if (post_ecg_date >= drug_start_date) and (post_ecg_date-drug_end_date).days <= 36:
                    pt2qtdb[pt][era_num,post_ecg_date,pre_qt,post_qt].append( (drug_concept_id,drug_start_date,drug_end_date) )



# Calculate median drug effect to assign swap frequency
print "Binning drugs by effect (median deltaQTc)"
drug2deltas = defaultdict(list) # all deltas for a drug
drug2change = dict() # median delta per drug

for person_id in tqdm(pt2qtdb.keys()):
    if len(pt2qtdb[person_id]) == 0:
        continue
    for pt_era_orig,post_ecg_date,pre_qt,post_qt in pt2qtdb[person_id]:
        for (drug_concept_id, drug_start_date,drug_end_date) in pt2qtdb[person_id][pt_era_orig,post_ecg_date,pre_qt,post_qt]:
            drug2deltas[drug_concept_id].append(post_qt-pre_qt)          

drug_changes = []
for drug_concept_id in sorted(drug2deltas.keys()):
    drug2change[drug_concept_id] = np.median(drug2deltas[drug_concept_id])
    drug_changes.append( np.median(drug2deltas[drug_concept_id]) )



# Bin drugs by effect (median deltaQTc)
num_bins = 10
bins = np.linspace(min(drug_changes), max(drug_changes), num_bins)
bin_ind = np.digitize(drug_changes, bins)

bin2drugs = defaultdict(list)
drug2bin = dict()

for bin_ind_, drug in zip(bin_ind,sorted(drug2change.keys())):
    bin2drugs[bin_ind_].append(drug)
    drug2bin[drug] = bin_ind_
    #print "%2d" %bin_ind_, '\t', "%15s" %drug2name[drug][0:15],'\t', "%.1f" %drug2change[drug],'\t', len(drug2deltas[drug])



# Calculate swap frequency such that drugs with a greater effect get swapped less frequently
print "Calculating swap frequencies"
keys = [10-i for i in range(10)]
vals = np.logspace(np.log10(0.001/100), np.log10(1./100), 10)
bin2swap_freq = dict(zip(keys,vals))
# print bin2swap_freq



# Calculate number of swapped ECG eras per drug
drug2num_swap = dict()
for bin_ind_ in sorted(bin2drugs.keys()):
    #print bin_ind_,'-> %s%%' %str(bin2swap_freq[bin_ind_]*100)
    for drug in bin2drugs[bin_ind_]:
        drug2num_swap[drug] = int(round(bin2swap_freq[bin_ind_]*len(drug2deltas[drug])))
        #print '\t%20s' %drug2name[drug][:20], '\t', len(drug2deltas[drug]), '\t%d' %round(bin2swap_freq[bin_ind_]*len(drug2deltas[drug]))



# Define eras to swap
print "Defining candidate ECG eras for drug swap"
pt_list_swap = [pt for pt in pt2qtdb.keys() if len(pt2qtdb[pt]) != 0]

eras_to_remove = dict()
eras_to_add = dict()

for swap_drug in tqdm(drug2num_swap.keys()):
    random.shuffle(pt_list_swap)
    num_swap = drug2num_swap[swap_drug]
    
    pt_w_drug_to_remove = set() # (person_id, pt_era_orig) containing given drug: candidates for removing exposure
    pt_wo_drug_to_add   = set() # (person_id, pt_era_orig) not containing given drug: candidates for adding exposure
    
    # Collect list of pt_eras that contain/ don't contain drug
    for person_id in pt_list_swap:
        for pt_era_orig,post_ecg_date,pre_qt,post_qt in pt2qtdb[person_id]:
            for (drug_concept_id, drug_start_date,drug_end_date) in pt2qtdb[person_id][pt_era_orig,post_ecg_date,pre_qt,post_qt]:
                if drug_concept_id == swap_drug:
                    pt_w_drug_to_remove.add( (person_id, pt_era_orig) )
            # Same drug can be present multiple times in same era;
            # collect all instances in set first then if not found, assign as removal candidate
            if (person_id, pt_era_orig) not in pt_w_drug_to_remove:
                pt_wo_drug_to_add.add( (person_id, pt_era_orig) )
    
    # Confirm add/ remove sets are distinct
    if len( pt_w_drug_to_remove & pt_wo_drug_to_add ) > 1:
        print "Overlap found for",drug2name[swap_drug], person_id, pt_era_orig
    
    # Randomly choose `num_swap` eras to swap without replacement
    pt_w_drug_to_remove_arr = np.array(list(pt_w_drug_to_remove))
    idx = np.random.choice(len(pt_w_drug_to_remove_arr), size=num_swap, replace=False)
    eras_to_remove[swap_drug] = list(map(tuple, pt_w_drug_to_remove_arr[idx]))
    
    pt_wo_drug_to_add_arr = np.array(list( pt_wo_drug_to_add ))
    idx = np.random.choice(len(pt_wo_drug_to_add_arr), size=num_swap, replace=False)
    eras_to_add[swap_drug] = list(map(tuple, pt_wo_drug_to_add_arr[idx]))



# Build swapped QTDb dictionary
print "Swapping drugs"
pt2qtdb_swap = dict()

for person_id in tqdm(pt2qtdb.keys()):
    pt2qtdb_swap[person_id] = defaultdict(list)
    for pt_era_orig,post_ecg_date,pre_qt,post_qt in pt2qtdb[person_id]:
        for (drug_concept_id, drug_start_date,drug_end_date) in pt2qtdb[person_id][pt_era_orig,post_ecg_date,pre_qt,post_qt]:
            # Check if drug should be removed from era
            if (person_id, pt_era_orig) in eras_to_remove[drug_concept_id]:
                continue
            # Otherwise add as normal
            else:
                pt2qtdb_swap[person_id][pt_era_orig,post_ecg_date,pre_qt,post_qt].append( (drug_concept_id, drug_start_date,drug_end_date) )
        
        # Check if era should add any drugs
        for drug in eras_to_add.keys():
            if (person_id, pt_era_orig) in eras_to_add[drug]:
                pt2qtdb_swap[person_id][pt_era_orig,post_ecg_date,pre_qt,post_qt].append( (drug, "swap","swap") )


# Function for randomly adjusting age +/- 0-5 years
def shuffle_age(ecg_date,bday,prev_age=None):
    age = int( (ecg_date-bday).days/365.25 )
    
    operators = [operator.add, operator.sub]
    random_operator = random.choice(operators)
    
    age_shift = random.randint(0,5)
    
    shuffled_age = random_operator(age, age_shift)
    
    if shuffled_age < 18:
        shuffled_age = 18
    if shuffled_age > 89:
        shuffled_age = 89
        
    if prev_age is not None:
        if shuffled_age < prev_age:
            shuffled_age = prev_age
    
    return shuffled_age


# Save drugs to csv
print "Done! Saving database to csv"
outf = open('qtdb_Drug.csv', 'w')
writer = csv.writer(outf)
writer.writerow(['drug_concept_id', 'drug'])
for drugname in sorted(drugname2concept_id.keys()):
    concept_id = drugname2concept_id[drugname]
    writer.writerow([concept_id, drugname])
outf.close()



# Save QTDb to csv
outf_dem = open('qtdb_Patient.csv','w')
writer_dem = csv.writer(outf_dem)
writer_dem.writerow(['pt_id_era', 'pt_id', 'era', 'age', 'sex', 'race', 'num_drugs', 'pre_qt_500', 'post_qt_500', 'delta_qt'])

outf_drug = open('qtdb_Patient2Drug.csv','w')
writer_drug = csv.writer(outf_drug)
writer_drug.writerow(['pt_id_era', 'drug_concept_id'])

outf_anon = open('qtdb.csv','w')
writer_anon = csv.writer(outf_anon)
writer_anon.writerow(['pt_id_era', 'pt_id', 'era', 'age', 'sex', 'race', 'num_drugs', 'drug_concept_id', 'drug_name', 'pre_qt_500', 'post_qt_500', 'delta_qt'])

pt_list = [pt for pt in pt2qtdb_swap.keys() if len(pt2qtdb_swap[pt]) != 0]
random.shuffle(pt_list)
for i,person_id in tqdm(enumerate(pt_list), total=len(pt_list)):
    pt_era = 0
    prev_age = None
    for pt_era_orig,post_ecg_date,pre_qt,post_qt in pt2qtdb_swap[person_id]:
        pt_era += 1
        pt_age = shuffle_age(post_ecg_date, pt2bday[person_id], prev_age)
        
        prev_age = pt_age
        
        drug_set = set()
        for (drug_concept_id, drug_start_date,drug_end_date) in pt2qtdb_swap[person_id][pt_era_orig,post_ecg_date,pre_qt,post_qt]:
            drug_set.add(drug_concept_id)
        num_drugs = len(drug_set)
        
        pre_qt_500 = 0
        post_qt_500 = 0
        if pre_qt >= 500:
            pre_qt_500 = 1
        if post_qt >= 500:
            post_qt_500 = 1
        
        writer_dem.writerow(['%d_%d' %(i+1,pt_era), i+1, pt_era, pt_age, pt2sex[person_id], pt2race[person_id], num_drugs, pre_qt_500, post_qt_500, post_qt-pre_qt])
        
        for drug_concept_id in drug_set:
            writer_drug.writerow(['%d_%d' %(i+1,pt_era), drug_concept_id])
            
            writer_anon.writerow(['%d_%d' %(i+1,pt_era), i+1, pt_era, pt_age, pt2sex[person_id], pt2race[person_id], num_drugs, 
                                  drug_concept_id, drug2name[drug_concept_id],
                                  pre_qt_500, post_qt_500, post_qt-pre_qt])
        
outf_dem.close()
outf_drug.close()
outf_anon.close()



cur.close()
con.close()

