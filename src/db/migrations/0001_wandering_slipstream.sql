CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blockchain" varchar(100) NOT NULL,
	"test_suite" varchar(200) NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"status" varchar(20) NOT NULL,
	"duration" integer NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "test_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"test_name" varchar(300) NOT NULL,
	"status" varchar(20) NOT NULL,
	"duration" integer NOT NULL,
	"error_message" text,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "test_results" ADD CONSTRAINT "fk_test_results_report_id" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_reports_timestamp" ON "reports" USING btree ("timestamp" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_reports_blockchain" ON "reports" USING btree ("blockchain");--> statement-breakpoint
CREATE INDEX "idx_reports_status" ON "reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_reports_metadata" ON "reports" USING btree ("metadata");--> statement-breakpoint
CREATE INDEX "idx_reports_blockchain_status" ON "reports" USING btree ("blockchain","status");--> statement-breakpoint
CREATE INDEX "idx_reports_timestamp_status" ON "reports" USING btree ("timestamp" DESC NULLS LAST,"status");--> statement-breakpoint
CREATE INDEX "idx_test_results_report_id" ON "test_results" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "idx_test_results_status" ON "test_results" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_test_results_test_name" ON "test_results" USING btree ("test_name");--> statement-breakpoint
CREATE INDEX "idx_test_results_report_status" ON "test_results" USING btree ("report_id","status");--> statement-breakpoint
CREATE INDEX "idx_test_results_status_test_name" ON "test_results" USING btree ("status","test_name");