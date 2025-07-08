-- Update student_profiles table to match the new API structure
ALTER TABLE student_profiles 
ADD COLUMN goals TEXT,
ADD COLUMN academic_level VARCHAR(20);

-- Optional: Remove old columns if no longer needed
-- ALTER TABLE student_profiles 
-- DROP COLUMN short_term_goals,
-- DROP COLUMN long_term_goals,
-- DROP COLUMN academic_goals,
-- DROP COLUMN personal_goals,
-- DROP COLUMN student_id,
-- DROP COLUMN year_level,
-- DROP COLUMN major,
-- DROP COLUMN profile_photo_url,
-- DROP COLUMN contact_preferences,
-- DROP COLUMN activities,
-- DROP COLUMN profile_completed,
-- DROP COLUMN completion_percentage; 