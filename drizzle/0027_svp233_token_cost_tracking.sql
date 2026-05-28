ALTER TABLE `evaluations` ADD `ai_provider` text;--> statement-breakpoint
ALTER TABLE `evaluations` ADD `input_tokens` integer;--> statement-breakpoint
ALTER TABLE `evaluations` ADD `output_tokens` integer;--> statement-breakpoint
ALTER TABLE `evaluations` ADD `cost_usd_cents` integer;