plugins {
	java
	jacoco
	id("org.springframework.boot") version "4.1.0"
	id("io.spring.dependency-management") version "1.1.7"
	id("org.jooq.jooq-codegen-gradle") version "3.21.5"
}

group = "com.proustclub"
version = "0.0.1-SNAPSHOT"

java {
	toolchain {
		languageVersion = JavaLanguageVersion.of(21)
	}
}

repositories {
	mavenCentral()
}

val schemaMigrator by sourceSets.creating
configurations[schemaMigrator.implementationConfigurationName]
	.extendsFrom(configurations.getByName("implementation"))
configurations[schemaMigrator.runtimeOnlyConfigurationName]
	.extendsFrom(configurations.getByName("runtimeOnly"))

dependencies {
	jooqCodegen("org.postgresql:postgresql:42.7.11")

	implementation("org.springframework.boot:spring-boot-starter-actuator")
	implementation("org.springframework.boot:spring-boot-starter-flyway")
	implementation("org.springframework.boot:spring-boot-starter-jooq")
	implementation("org.springframework.boot:spring-boot-starter-mail")
	implementation("org.springframework.boot:spring-boot-starter-security")
	implementation("org.springframework.boot:spring-boot-starter-validation")
	implementation("org.springframework.boot:spring-boot-starter-webmvc")
	implementation("org.flywaydb:flyway-database-postgresql")
	implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:3.0.3")
	runtimeOnly("org.postgresql:postgresql")
	// Argon2id (PasswordEncoder) — Spring Security delegates to BouncyCastle for the implementation
	runtimeOnly("org.bouncycastle:bcprov-jdk18on:1.85")
	// Rate limiting: Bucket4j (token-bucket algorithm) + Caffeine (bounded, self-evicting local
	// cache for the bucket-per-key storage) — no distributed backend, no Spring Boot starter
	implementation("com.bucket4j:bucket4j_jdk17-core:8.19.0")
	implementation("com.github.ben-manes.caffeine:caffeine:3.2.4")
	testImplementation("org.springframework.boot:spring-boot-starter-actuator-test")
	testImplementation("org.springframework.boot:spring-boot-starter-flyway-test")
	testImplementation("org.springframework.boot:spring-boot-starter-jooq-test")
	testImplementation("org.springframework.boot:spring-boot-starter-security-test")
	testImplementation("org.springframework.boot:spring-boot-starter-validation-test")
	testImplementation("org.springframework.boot:spring-boot-starter-webmvc-test")
	testImplementation("org.springframework.boot:spring-boot-testcontainers")
	testImplementation("org.testcontainers:testcontainers-junit-jupiter")
	testImplementation("org.testcontainers:testcontainers-postgresql")
	testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

jooq {
	configuration {
		jdbc {
			driver = "org.postgresql.Driver"
			url = System.getenv("JOOQ_DB_URL") ?: "jdbc:postgresql://localhost:5432/proustclub"
			user = System.getenv("JOOQ_DB_USERNAME") ?: "proustclub"
			password = System.getenv("JOOQ_DB_PASSWORD") ?: "proustclub_dev"
		}
		generator {
			name = "org.jooq.codegen.JavaGenerator"
			database {
				name = "org.jooq.meta.postgres.PostgresDatabase"
				inputSchema = "public"
				excludes = "flyway_schema_history"
			}
			generate {
				isPojos = false
				isDaos = false
				isRoutines = false
				isSequences = false
			}
			target {
				packageName = "com.proustclub.jooq"
				directory = "build/generated-src/jooq/main"
			}
		}
	}
}

val migrateSchemaForCodegen by tasks.registering(JavaExec::class) {
	group = "jooq"
	description = "Applies pending Flyway migrations before jOOQ code generation"
	dependsOn(tasks.named(schemaMigrator.classesTaskName))
	classpath = schemaMigrator.runtimeClasspath
	mainClass.set("com.proustclub.codegen.MigrateSchemaForCodegen")
}

tasks.named("jooqCodegen") {
	dependsOn(migrateSchemaForCodegen)
}

tasks.named("compileJava") {
	dependsOn(tasks.named("jooqCodegen"))
}

tasks.withType<Test> {
	useJUnitPlatform()
}

// ---------------------------------------------------------------------------
// Code coverage — JaCoCo
// Explicit chain test -> jacocoTestReport -> jacocoTestCoverageVerification -> check,
// so the XML report always exists before an insufficient coverage can fail the
// build (needed by the $GITHUB_STEP_SUMMARY step in CI, which must stay readable
// even when the threshold isn't met).
// 90% threshold chosen below the measured coverage (96.25% on 2026-08-31), as an
// anti-regression guardrail, not a coverage target.
// ---------------------------------------------------------------------------
tasks.jacocoTestReport {
	dependsOn(tasks.test)
	classDirectories.setFrom(
		sourceSets.main.get().output.asFileTree.matching {
			exclude("com/proustclub/jooq/**")
		}
	)
	reports {
		xml.required = true
		html.required = true
	}
}

tasks.jacocoTestCoverageVerification {
	dependsOn(tasks.jacocoTestReport)
	classDirectories.setFrom(
		sourceSets.main.get().output.asFileTree.matching {
			exclude("com/proustclub/jooq/**")
		}
	)
	violationRules {
		rule {
			limit {
				counter = "LINE"
				minimum = "0.90".toBigDecimal()
			}
		}
	}
}

tasks.check {
	dependsOn(tasks.jacocoTestCoverageVerification)
}

// ---------------------------------------------------------------------------
// Corpus import CLI
// Usage : ./gradlew importProust
//      ou : java -jar app.jar import-proust
// Nécessite : docker compose up -d (PostgreSQL doit être démarré)
// ---------------------------------------------------------------------------
tasks.register<JavaExec>("importProust") {
	group = "application"
	description = "Import le corpus Proust dans la base de données"
	classpath = sourceSets.main.get().runtimeClasspath
	mainClass.set("com.proustclub.ProustClubApplication")
	args = listOf("import-proust")
}

// ---------------------------------------------------------------------------
// jOOQ code generation
// A PostgreSQL database must be available; Flyway migrations are applied before
// code generation. Run docker compose up -d postgres, then ./gradlew jooqCodegen.
// ---------------------------------------------------------------------------
