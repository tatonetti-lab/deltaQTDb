# Drug table
CREATE TABLE `Drug` (
  `drug_concept_id` int(11) unsigned NOT NULL,
  `drug_name` varchar(255) NOT NULL DEFAULT '',
  PRIMARY KEY (`drug_concept_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

LOAD DATA LOCAL INFILE 'qtdb_Drug.csv'
INTO TABLE Drug
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\r\n'
IGNORE 1 LINES;

# Patient table
CREATE TABLE `Patient` (
  `pt_id_era` varchar(11) NOT NULL DEFAULT '',
  `pt_id` int(11) NOT NULL,
  `era` int(11) NOT NULL,
  `age` int(11) NOT NULL,
  `sex` varchar(1) NOT NULL DEFAULT '',
  `race` varchar(1) NOT NULL,
  `num_drugs` int(11) NOT NULL,
  `pre_qt_500` int(1) NOT NULL DEFAULT '0',
  `post_qt_500` int(1) NOT NULL DEFAULT '0',
  `delta_qt` int(11) NOT NULL,
  PRIMARY KEY (`pt_id_era`),
  KEY `pt_id` (`pt_id`,`era`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

LOAD DATA LOCAL INFILE 'qtdb_Patient.csv'
INTO TABLE Patient
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 LINES;

# Patient to drug mapping table
CREATE TABLE `Patient2Drug` (
  `pt_id_era` varchar(11) NOT NULL DEFAULT '',
  `drug_concept_id` int(11) NOT NULL,
  PRIMARY KEY (`pt_id_era`,`drug_concept_id`),
  UNIQUE KEY `ix_ReversePK` (`drug_concept_id`,`pt_id_era`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

LOAD DATA LOCAL INFILE 'qtdb_Patient2Drug.csv'
INTO TABLE Patient2Drug
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 LINES;