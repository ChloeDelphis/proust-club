plugins {
	java
	jacoco
	id("org.springframework.boot") version "4.1.0"
	id("io.spring.dependency-management") version "1.1.7"
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

dependencies {
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
	reports {
		xml.required = true
		html.required = true
	}
}

tasks.jacocoTestCoverageVerification {
	dependsOn(tasks.jacocoTestReport)
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
// jOOQ code generation — À configurer
// Le plugin nu.studer.jooq doit être ajouté dans le bloc plugins{}.
// Version compatible Gradle 9.x à vérifier sur :
//   https://plugins.gradle.org/plugin/nu.studer.jooq
// Workflow : docker compose up -d → ./gradlew generateJooq → ./gradlew bootRun
// ---------------------------------------------------------------------------
