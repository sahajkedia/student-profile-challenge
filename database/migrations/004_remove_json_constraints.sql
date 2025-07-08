-- Remove JSON validation constraints from skills and interests columns
ALTER TABLE student_profiles 
MODIFY COLUMN skills LONGTEXT,
MODIFY COLUMN interests LONGTEXT,
MODIFY COLUMN contact_preferences LONGTEXT,
MODIFY COLUMN activities LONGTEXT; 