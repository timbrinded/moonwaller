ALTER TABLE "reports" ADD CONSTRAINT "reports_status_check" CHECK ("reports"."status" IN ('pass', 'fail', 'skip', 'running', 'pending'));--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_duration_check" CHECK ("reports"."duration" >= 0);--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_blockchain_not_empty" CHECK (length(trim("reports"."blockchain")) > 0);--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_test_suite_not_empty" CHECK (length(trim("reports"."test_suite")) > 0);--> statement-breakpoint
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_status_check" CHECK ("test_results"."status" IN ('pass', 'fail', 'skip'));--> statement-breakpoint
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_duration_check" CHECK ("test_results"."duration" >= 0);--> statement-breakpoint
ALTER TABLE "test_results" ADD CONSTRAINT "test_results_test_name_not_empty" CHECK (length(trim("test_results"."test_name")) > 0);