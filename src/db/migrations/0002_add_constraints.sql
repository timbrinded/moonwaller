-- Add database constraints and validation rules for moonwall test reports

-- Add check constraints for reports table
ALTER TABLE "reports" ADD CONSTRAINT "reports_status_check" 
CHECK (status IN ('pass', 'fail', 'skip', 'running', 'pending'));

ALTER TABLE "reports" ADD CONSTRAINT "reports_duration_check" 
CHECK (duration >= 0);

ALTER TABLE "reports" ADD CONSTRAINT "reports_blockchain_not_empty" 
CHECK (length(trim(blockchain)) > 0);

ALTER TABLE "reports" ADD CONSTRAINT "reports_test_suite_not_empty" 
CHECK (length(trim(test_suite)) > 0);

-- Add check constraints for test_results table
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_status_check" 
CHECK (status IN ('pass', 'fail', 'skip'));

ALTER TABLE "test_results" ADD CONSTRAINT "test_results_duration_check" 
CHECK (duration >= 0);

ALTER TABLE "test_results" ADD CONSTRAINT "test_results_test_name_not_empty" 
CHECK (length(trim(test_name)) > 0);

-- Add GIN index for JSONB metadata fields for efficient querying
CREATE INDEX "idx_reports_metadata_gin" ON "reports" USING gin ("metadata");
CREATE INDEX "idx_test_results_details_gin" ON "test_results" USING gin ("details");

-- Add partial indexes for common query patterns
CREATE INDEX "idx_reports_failed_recent" ON "reports" ("timestamp" DESC) 
WHERE status = 'fail' AND timestamp > (NOW() - INTERVAL '7 days');

CREATE INDEX "idx_test_results_failed" ON "test_results" ("report_id", "test_name") 
WHERE status = 'fail';

-- Add index for full-text search on test names
CREATE INDEX "idx_test_results_test_name_trgm" ON "test_results" 
USING gin (test_name gin_trgm_ops);

-- Enable pg_trgm extension for trigram matching (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_trgm;