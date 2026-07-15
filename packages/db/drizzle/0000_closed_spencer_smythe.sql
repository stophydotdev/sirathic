CREATE TYPE "public"."grade" AS ENUM('sahih', 'hasan', 'daif', 'mawdu');--> statement-breakpoint
CREATE TYPE "public"."madhhab" AS ENUM('hanafi', 'shafii', 'maliki', 'hanbali', 'shia', 'cross');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('quran', 'hadith', 'tafsir', 'fatwa', 'athar');--> statement-breakpoint
CREATE TYPE "public"."tier" AS ENUM('A', 'B', 'C');--> statement-breakpoint
CREATE TABLE "corpus" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_type" "source_type" NOT NULL,
	"source_domain" text NOT NULL,
	"tier" "tier" NOT NULL,
	"madhhab" "madhhab" DEFAULT 'cross' NOT NULL,
	"ref" text NOT NULL,
	"lang" text NOT NULL,
	"title" text,
	"text" text NOT NULL,
	"embedding" vector(1024),
	"grade" "grade",
	"narrator" text,
	"url" text NOT NULL,
	"content_hash" text NOT NULL,
	"embed_model" text DEFAULT 'baai/bge-m3' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "corpus_source_ref_lang_uniq" ON "corpus" USING btree ("source_domain","ref","lang");--> statement-breakpoint
CREATE INDEX "corpus_embedding_hnsw" ON "corpus" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "corpus_filter_idx" ON "corpus" USING btree ("source_type","tier","madhhab");--> statement-breakpoint
CREATE INDEX "corpus_grade_idx" ON "corpus" USING btree ("grade");
