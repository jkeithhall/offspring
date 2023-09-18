CREATE TABLE IF NOT EXISTS "Users" (
    "ID" int   NOT NULL,
    "Name" varchar(255)   NOT NULL,
    "Sex" char(1)   NOT NULL,
    CONSTRAINT "pk_Users" PRIMARY KEY ("ID")
);
CREATE TABLE IF NOT EXISTS "User-connections" (
    "ID" int   NOT NULL,
    "user_1_ID" int   NOT NULL,
    "user_2_ID" int   NOT NULL,
    CONSTRAINT "pk_User-connections" PRIMARY KEY ("ID")
);

CREATE TABLE IF NOT EXISTS "Genomes" (
    "ID" int   NOT NULL,
    "user_ID" int   NOT NULL,
    "upload_datetime" timestamp   NOT NULL,
    CONSTRAINT "pk_Genomes" PRIMARY KEY ("ID")
);

CREATE TABLE IF NOT EXISTS "SNPs" (
    "ID" int   NOT NULL,
    "genome" int   NOT NULL,
    "rsid" varchar(20)   NOT NULL,
    "chromosome" varchar(8)   NOT NULL,
    "position" smallint   NOT NULL,
    "genotype" varchar(8)   NOT NULL,
    CONSTRAINT "pk_SNPs" PRIMARY KEY ("ID")
);

ALTER TABLE "User-connections" ADD CONSTRAINT "fk_User-connections_user_1_ID" FOREIGN KEY("user_1_ID")
REFERENCES "Users" ("ID");

ALTER TABLE "User-connections" ADD CONSTRAINT "fk_User-connections_user_2_ID" FOREIGN KEY("user_2_ID")
REFERENCES "Users" ("ID");

ALTER TABLE "Genomes" ADD CONSTRAINT "fk_Genomes_user_ID" FOREIGN KEY("user_ID")
REFERENCES "Users" ("ID");

ALTER TABLE "SNPs" ADD CONSTRAINT "fk_SNPs_genome" FOREIGN KEY("genome")
REFERENCES "Genomes" ("ID");

CREATE INDEX "idx_Users_Name" ON "Users" ("Name");

CREATE INDEX "idx_genome_chromosome_position" ON "SNPs" ("genome", "chromosome", "position");