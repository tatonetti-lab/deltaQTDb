# ∆QT Database
An online resource for exploring drug-induced QT interval prolongation

**Available at www.deltaqt.org**

This project contains all the source code for creating ∆QT Database (∆QTDb) and running the web application. We built the ∆QTDb web app using [React](https://facebook.github.io/react/) and [D3](https://d3js.org/) for the frontend and [Bottle](http://bottlepy.org/docs/dev/) for the backend.

We created ∆QTDb by deidentifying a subset of electronic health recored (EHR) data mapped to the Observational Health Data Sciences and Informatics Common Data Model (OHDSI CDM), https://www.ohdsi.org/. See http://www.deltaqt.org/faq#data-processing for a description of the deidentification protocol. The Python script for creating the database (see `create_QTDb.py`) has been tested on OHDSI CDM v4 and v5. Running the script requires:
- MySQLdb (connecting to MySQL database containing CDM)
- [tqdm](https://pypi.python.org/pypi/tqdm) (a great progress bar library)

For questions about ∆QTDb contact:  
Tal Lorberbaum: tal.lorberbaum_columbia.edu  
Nicholas Tatonetti: nick.tatonetti_columbia.edu  

<a href="http://tatonettilab.org/"><img src="http://www.deltaqt.org/index/img/tlab-logo.png" height="56"></a>

---

∆QT Database is released under a Creative Commons BY-NC-SA 4.0 license. For complete details see LICENSE.txt or visit http://creativecommons.org/licenses/by-nc-sa/4.0/

![CC BY-NC-SA 4.0](https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Cc-by-nc-sa_icon.svg/100px-Cc-by-nc-sa_icon.svg.png)
