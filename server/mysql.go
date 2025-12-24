// Copyright (C) 2019-2024 Chrystian Huot <chrystian@huot.qc.ca>
// Modified by Thinline Dynamic Solutions
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>

package main

var MysqlSchema = []string{
	`CREATE TABLE IF NOT EXISTS "apikeys" (
    "apikeyId" bigint NOT NULL AUTO_INCREMENT PRIMARY KEY,
    "disabled" boolean NOT NULL DEFAULT false,
    "ident" text NOT NULL,
    "key" text NOT NULL,
    "order" integer NOT NULL DEFAULT 0,
    "systems" text NOT NULL DEFAULT ''
  );`,

	`CREATE TABLE IF NOT EXISTS "downstreams" (
    "downstreamId" bigint NOT NULL AUTO_INCREMENT PRIMARY KEY,
    "apikey" text NOT NULL,
    "disabled" boolean NOT NULL DEFAULT false,
    "order" integer NOT NULL DEFAULT 0,
    "systems" text NOT NULL DEFAULT '',
    "url" text NOT NULL
  );`,

	`CREATE TABLE IF NOT EXISTS "groups" (
    "groupId" bigint NOT NULL AUTO_INCREMENT PRIMARY KEY,
    "label" text NOT NULL,
    "order" integer NOT NULL DEFAULT 0
  );`,

	`CREATE TABLE IF NOT EXISTS "tags" (
    "tagId" bigint NOT NULL AUTO_INCREMENT PRIMARY KEY,
    "label" text NOT NULL,
    "order" integer NOT NULL DEFAULT 0
  );`,

	`CREATE TABLE IF NOT EXISTS "systems" (
    "systemId" bigint NOT NULL AUTO_INCREMENT PRIMARY KEY,
    "autoPopulate" boolean NOT NULL DEFAULT false,
    "blacklists" text NOT NULL DEFAULT '',
    "delay" integer NOT NULL DEFAULT 0,
    "label" text NOT NULL,
    "order" integer NOT NULL DEFAULT 0,
    "systemRef" integer NOT NULL,
    "type" text NOT NULL DEFAULT ''
  );`,

	`CREATE TABLE IF NOT EXISTS "sites" (
    "siteId" bigint NOT NULL AUTO_INCREMENT PRIMARY KEY,
    "label" text NOT NULL,
    "order" integer NOT NULL DEFAULT 0,
    "siteRef" integer NOT NULL,
    "systemId" bigint NOT NULL DEFAULT 0,
    FOREIGN KEY ("systemId") REFERENCES "systems" ("systemId") ON DELETE CASCADE ON UPDATE CASCADE
  );`,

	`CREATE TABLE IF NOT EXISTS "talkgroups" (
    "talkgroupId" bigint NOT NULL AUTO_INCREMENT PRIMARY KEY,
    "delay" integer NOT NULL DEFAULT 0,
    "frequency" integer NOT NULL DEFAULT 0,
    "label" text NOT NULL,
    "name" text NOT NULL,
    "order" integer NOT NULL DEFAULT 0,
    "systemId" bigint NOT NULL,
    "tagId" bigint NOT NULL,
    "talkgroupRef" integer NOT NULL,
    "type" text NOT NULL DEFAULT '',
    "toneDetectionEnabled" boolean NOT NULL DEFAULT false,
    "toneSets" text NOT NULL DEFAULT '[]',
    FOREIGN KEY ("systemId") REFERENCES "systems" ("systemId") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("tagId") REFERENCES "tags" ("tagId") ON DELETE CASCADE ON UPDATE CASCADE
  );`,

	`CREATE TABLE IF NOT EXISTS "talkgroupGroups" (
    "talkgroupGroupId" bigint NOT NULL AUTO_INCREMENT PRIMARY KEY,
    "groupId" bigint NOT NULL,
    "talkgroupId" bigint NOT NULL,
    FOREIGN KEY ("groupId") REFERENCES "groups" ("groupId") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("talkgroupId") REFERENCES "talkgroups" ("talkgroupId") ON DELETE CASCADE ON UPDATE CASCADE
  );`,

	`CREATE TABLE IF NOT EXISTS "calls" (
    "callId" bigint NOT NULL AUTO_INCREMENT PRIMARY KEY,
    "audio" blob NOT NULL,
    "audioFilename" text NOT NULL,
    "audioMime" text NOT NULL,
    "siteRef" integer NOT NULL DEFAULT 0,
    "systemId" bigint NOT NULL,
    "talkgroupId" bigint NOT NULL,
    "timestamp" bigint NOT NULL,
    "frequency" integer NOT NULL DEFAULT 0,
    FOREIGN KEY ("systemId") REFERENCES "systems" ("systemId") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("talkgroupId") REFERENCES "talkgroups" ("talkgroupId") ON DELETE CASCADE ON UPDATE CASCADE
  );`,

	`CREATE INDEX IF NOT EXISTS "calls_idx" ON "calls" ("systemId","siteRef","talkgroupId","timestamp");`,
	`ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "frequency" integer NOT NULL DEFAULT 0;`,
	`ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "systemRef" integer NOT NULL DEFAULT 0;`,
	`ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "talkgroupRef" integer NOT NULL DEFAULT 0;`,
	`ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "toneSequence" text NOT NULL DEFAULT '';`,
	`ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "hasTones" boolean NOT NULL DEFAULT false;`,
	`ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "transcript" text NOT NULL DEFAULT '';`,
	`ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "transcriptConfidence" float NOT NULL DEFAULT 0;`,
	`ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "transcriptionStatus" text NOT NULL DEFAULT 'pending';`,
	`CREATE INDEX IF NOT EXISTS "calls_refs_idx" ON "calls" ("systemRef","talkgroupRef","timestamp");`,
	`CREATE INDEX IF NOT EXISTS "calls_tones_idx" ON "calls" ("hasTones","timestamp");`,
	`CREATE INDEX IF NOT EXISTS "calls_transcript_idx" ON "calls" ("transcriptionStatus","timestamp");`,
	`DROP TABLE IF EXISTS "callFrequencies";`,

	`CREATE TABLE IF NOT EXISTS "callPatches" (
    "callPatchId" bigint NOT NULL AUTO_INCREMENT PRIMARY KEY,
    "callId" bigint NOT NULL,
    "talkgroupId" bigint NOT NULL,
    FOREIGN KEY ("callId") REFERENCES "calls" ("callId") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("talkgroupId") REFERENCES "talkgroups" ("talkgroupId") ON DELETE CASCADE ON UPDATE CASCADE
  );`,

	`CREATE TABLE IF NOT EXISTS "callUnits" (
    "callUnitId" bigint NOT NULL AUTO_INCREMENT PRIMARY KEY,
    "callId" bigint NOT NULL,
    "offset" real NOT NULL,
    "unitRef" bigint NOT NULL,
    FOREIGN KEY ("callId") REFERENCES "calls" ("callId") ON DELETE CASCADE ON UPDATE CASCADE
  );`,
	
	// Migration: Change unitRef from integer to bigint for large radio unit IDs  
	`ALTER TABLE "callUnits" MODIFY COLUMN "unitRef" bigint NOT NULL;`,

	`CREATE TABLE IF NOT EXISTS "delayed" (
    "delayedId" bigint NOT NULL AUTO_INCREMENT PRIMARY KEY,
    "callId" bigint NOT NULL,
    "timestamp" bigint NOT NULL,
    FOREIGN KEY ("callId") REFERENCES "calls" ("callId") ON DELETE CASCADE ON UPDATE CASCADE
  );`,

	`CREATE TABLE IF NOT EXISTS "dirwatches" (
    "dirwatchId" bigint NOT NULL AUTO_INCREMENT PRIMARY KEY,
    "delay" integer NOT NULL DEFAULT 0,
    "deleteAfter" boolean NOT NULL DEFAULT false,
    "directory" text NOT NULL,
    "disabled" boolean NOT NULL DEFAULT false,
    "extension" text NOT NULL DEFAULT '',
    "frequency" integer NOT NULL DEFAULT 0,
    "mask" text NOT NULL DEFAULT '',
    "order" integer NOT NULL DEFAULT 0,
    "siteId" bigint NOT NULL DEFAULT 0,
    "systemId" bigint NOT NULL DEFAULT 0,
    "talkgroupId" bigint NOT NULL DEFAULT 0,
    "type" text NOT NULL DEFAULT ''
  );`,

	`CREATE TABLE IF NOT EXISTS "logs" (
    "logId" bigint NOT NULL AUTO_INCREMENT PRIMARY KEY,
    "level" text NOT NULL,
    "message" text NOT NULL,
    "timestamp" bigint NOT NULL
  );`,

	`CREATE TABLE IF NOT EXISTS "options" (
    "optionId" bigint NOT NULL AUTO_INCREMENT PRIMARY KEY,
    "key" text NOT NULL,
    "value" text NOT NULL
  );`,

	`CREATE TABLE IF NOT EXISTS "suspectedHallucinations" (
    "id" bigint NOT NULL AUTO_INCREMENT PRIMARY KEY,
    "phrase" text NOT NULL,
    "rejectedCount" integer NOT NULL DEFAULT 0,
    "acceptedCount" integer NOT NULL DEFAULT 0,
    "firstSeenAt" bigint NOT NULL DEFAULT 0,
    "lastSeenAt" bigint NOT NULL DEFAULT 0,
    "systemIds" text NOT NULL DEFAULT '',
    "status" varchar(50) NOT NULL DEFAULT 'pending',
    "autoAdded" boolean NOT NULL DEFAULT false,
    "createdAt" bigint NOT NULL DEFAULT 0,
    "updatedAt" bigint NOT NULL DEFAULT 0,
    UNIQUE KEY "phrase_unique" ("phrase"(500))
  );`,

	`CREATE TABLE IF NOT EXISTS "units" (
    "unitId" bigint NOT NULL AUTO_INCREMENT PRIMARY KEY,
    "label" text NOT NULL,
    "order" integer NOT NULL DEFAULT 0,
    "systemId" bigint NOT NULL,
    "unitRef" integer NOT NULL DEFAULT 0,
    "unitFrom" integer NOT NULL DEFAULT 0,
    "unitTo" integer NOT NULL DEFAULT 0,
    FOREIGN KEY ("systemId") REFERENCES "systems" ("systemId") ON DELETE CASCADE ON UPDATE CASCADE
  );`,

	`CREATE TABLE IF NOT EXISTS "users" (
    "userId" bigint NOT NULL AUTO_INCREMENT PRIMARY KEY,
    "email" varchar(255) NOT NULL UNIQUE,
    "password" text NOT NULL,
    "pin" varchar(64) NOT NULL UNIQUE,
    "pinExpiresAt" bigint NOT NULL DEFAULT 0,
    "connectionLimit" int NOT NULL DEFAULT 0,
    "verified" boolean NOT NULL DEFAULT false,
    "verificationToken" text NOT NULL DEFAULT '',
    "createdAt" text NOT NULL DEFAULT '',
    "lastLogin" text NOT NULL DEFAULT '',
    "firstName" text NOT NULL DEFAULT '',
    "lastName" text NOT NULL DEFAULT '',
    "zipCode" text NOT NULL DEFAULT '',
    "systems" text NOT NULL DEFAULT '',
    "delay" int NOT NULL DEFAULT 0,
    "systemDelays" text NOT NULL DEFAULT '',
    "talkgroupDelays" text NOT NULL DEFAULT '',
    "stripeCustomerId" text NOT NULL DEFAULT '',
    "stripeSubscriptionId" text NOT NULL DEFAULT '',
    "subscriptionStatus" text NOT NULL DEFAULT '',
    "accountExpiresAt" bigint NOT NULL DEFAULT 0,
    "settings" text NOT NULL DEFAULT ''
  );`,

	`CREATE TABLE IF NOT EXISTS "userAlertPreferences" (
    "userAlertPreferenceId" bigint NOT NULL AUTO_INCREMENT PRIMARY KEY,
    "userId" bigint NOT NULL,
    "systemId" bigint NOT NULL,
    "talkgroupId" bigint NOT NULL,
    "alertEnabled" boolean NOT NULL DEFAULT false,
    "toneAlerts" boolean NOT NULL DEFAULT true,
    "keywordAlerts" boolean NOT NULL DEFAULT true,
    "keywords" text NOT NULL DEFAULT '[]',
    "keywordListIds" text NOT NULL DEFAULT '[]',
    "toneSetIds" text NOT NULL DEFAULT '[]',
    FOREIGN KEY ("userId") REFERENCES "users" ("userId") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("systemId") REFERENCES "systems" ("systemId") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("talkgroupId") REFERENCES "talkgroups" ("talkgroupId") ON DELETE CASCADE ON UPDATE CASCADE,
    UNIQUE KEY ("userId", "systemId", "talkgroupId")
  );`,

	`CREATE TABLE IF NOT EXISTS "keywordLists" (
    "keywordListId" bigint NOT NULL AUTO_INCREMENT PRIMARY KEY,
    "label" text NOT NULL,
    "description" text NOT NULL DEFAULT '',
    "keywords" text NOT NULL DEFAULT '[]',
    "order" integer NOT NULL DEFAULT 0,
    "createdAt" bigint NOT NULL DEFAULT 0
  );`,

	`CREATE TABLE IF NOT EXISTS "alerts" (
    "alertId" bigint NOT NULL AUTO_INCREMENT PRIMARY KEY,
    "callId" bigint NOT NULL,
    "systemId" bigint NOT NULL,
    "talkgroupId" bigint NOT NULL,
    "alertType" text NOT NULL DEFAULT '',
    "toneDetected" boolean NOT NULL DEFAULT false,
    "toneSetId" text NOT NULL DEFAULT '',
    "keywordsMatched" text NOT NULL DEFAULT '[]',
    "transcriptSnippet" text NOT NULL DEFAULT '',
    "createdAt" bigint NOT NULL,
    FOREIGN KEY ("callId") REFERENCES "calls" ("callId") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("systemId") REFERENCES "systems" ("systemId") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("talkgroupId") REFERENCES "talkgroups" ("talkgroupId") ON DELETE CASCADE ON UPDATE CASCADE
  );`,

	`CREATE INDEX IF NOT EXISTS "alerts_created_idx" ON "alerts" ("createdAt");`,
	`CREATE INDEX IF NOT EXISTS "alerts_call_idx" ON "alerts" ("callId");`,

	`CREATE TABLE IF NOT EXISTS "transcriptions" (
    "transcriptionId" bigint NOT NULL AUTO_INCREMENT PRIMARY KEY,
    "callId" bigint NOT NULL,
    "transcript" text NOT NULL,
    "confidence" float NOT NULL DEFAULT 0,
    "language" text NOT NULL DEFAULT 'en',
    "userId" bigint,
    "createdAt" bigint NOT NULL,
    FOREIGN KEY ("callId") REFERENCES "calls" ("callId") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("userId") REFERENCES "users" ("userId") ON DELETE SET NULL ON UPDATE CASCADE
  );`,

	`CREATE INDEX IF NOT EXISTS "transcriptions_call_idx" ON "transcriptions" ("callId");`,

	`CREATE TABLE IF NOT EXISTS "keywordMatches" (
    "keywordMatchId" bigint NOT NULL AUTO_INCREMENT PRIMARY KEY,
    "callId" bigint NOT NULL,
    "userId" bigint NOT NULL,
    "keyword" text NOT NULL,
    "context" text NOT NULL DEFAULT '',
    "position" integer NOT NULL DEFAULT 0,
    "alerted" boolean NOT NULL DEFAULT false,
    FOREIGN KEY ("callId") REFERENCES "calls" ("callId") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("userId") REFERENCES "users" ("userId") ON DELETE CASCADE ON UPDATE CASCADE
  );`,

	`CREATE INDEX IF NOT EXISTS "keywordMatches_user_idx" ON "keywordMatches" ("userId","callId");`,

	`CREATE TABLE IF NOT EXISTS "userGroups" (
    "userGroupId" bigint NOT NULL AUTO_INCREMENT PRIMARY KEY,
    "name" text NOT NULL,
    "description" text NOT NULL DEFAULT '',
    "systemAccess" text NOT NULL DEFAULT '',
    "delay" int NOT NULL DEFAULT 0,
    "systemDelays" text NOT NULL DEFAULT '',
    "talkgroupDelays" text NOT NULL DEFAULT '',
    "connectionLimit" int NOT NULL DEFAULT 0,
    "maxUsers" int NOT NULL DEFAULT 0,
    "billingEnabled" boolean NOT NULL DEFAULT true,
    "stripePriceId" text NOT NULL DEFAULT '',
    "pricingOptions" text NOT NULL DEFAULT '',
    "billingMode" text NOT NULL DEFAULT 'all_users',
    "collectSalesTax" boolean NOT NULL DEFAULT false,
    "isPublicRegistration" boolean NOT NULL DEFAULT false,
    "allowAddExistingUsers" boolean NOT NULL DEFAULT false,
    "createdAt" bigint NOT NULL DEFAULT 0
  );`,

	`CREATE TABLE IF NOT EXISTS "registrationCodes" (
    "registrationCodeId" bigint NOT NULL AUTO_INCREMENT PRIMARY KEY,
    "code" text NOT NULL UNIQUE,
    "userGroupId" bigint NOT NULL,
    "createdBy" bigint NOT NULL,
    "expiresAt" bigint NOT NULL DEFAULT 0,
    "maxUses" int NOT NULL DEFAULT 0,
    "currentUses" int NOT NULL DEFAULT 0,
    "isOneTime" boolean NOT NULL DEFAULT false,
    "isActive" boolean NOT NULL DEFAULT true,
    "createdAt" bigint NOT NULL DEFAULT 0,
    FOREIGN KEY ("userGroupId") REFERENCES "userGroups" ("userGroupId") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("createdBy") REFERENCES "users" ("userId") ON DELETE CASCADE ON UPDATE CASCADE
  );`,

	`CREATE TABLE IF NOT EXISTS "userInvitations" (
    "userInvitationId" bigint NOT NULL AUTO_INCREMENT PRIMARY KEY,
    "email" text NOT NULL,
    "code" text NOT NULL UNIQUE,
    "userGroupId" bigint NOT NULL,
    "invitedBy" bigint NOT NULL,
    "invitedAt" bigint NOT NULL DEFAULT 0,
    "usedAt" bigint NOT NULL DEFAULT 0,
    "expiresAt" bigint NOT NULL DEFAULT 0,
    "status" text NOT NULL DEFAULT 'pending',
    FOREIGN KEY ("userGroupId") REFERENCES "userGroups" ("userGroupId") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("invitedBy") REFERENCES "users" ("userId") ON DELETE CASCADE ON UPDATE CASCADE
  );`,

	`CREATE TABLE IF NOT EXISTS "transferRequests" (
    "transferRequestId" bigint NOT NULL AUTO_INCREMENT PRIMARY KEY,
    "userId" bigint NOT NULL,
    "fromGroupId" bigint NOT NULL,
    "toGroupId" bigint NOT NULL,
    "requestedBy" bigint NOT NULL,
    "approvedBy" bigint NOT NULL DEFAULT 0,
    "status" text NOT NULL DEFAULT 'pending',
    "requestedAt" bigint NOT NULL DEFAULT 0,
    "approvedAt" bigint NOT NULL DEFAULT 0,
    "approvalToken" text NOT NULL DEFAULT '',
    "approvalTokenExpiresAt" bigint NOT NULL DEFAULT 0,
    "approvalTokenUsed" boolean NOT NULL DEFAULT false,
    FOREIGN KEY ("userId") REFERENCES "users" ("userId") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("fromGroupId") REFERENCES "userGroups" ("userGroupId") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("toGroupId") REFERENCES "userGroups" ("userGroupId") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("requestedBy") REFERENCES "users" ("userId") ON DELETE CASCADE ON UPDATE CASCADE
  );`,

	`CREATE TABLE IF NOT EXISTS "deviceTokens" (
    "deviceTokenId" bigint NOT NULL AUTO_INCREMENT PRIMARY KEY,
    "userId" bigint NOT NULL,
    "token" text NOT NULL,
    "platform" text NOT NULL DEFAULT 'android',
    "sound" text NOT NULL DEFAULT 'startup.wav',
    "createdAt" bigint NOT NULL DEFAULT 0,
    "lastUsed" bigint NOT NULL DEFAULT 0,
    FOREIGN KEY ("userId") REFERENCES "users" ("userId") ON DELETE CASCADE ON UPDATE CASCADE,
    UNIQUE KEY ("userId", "token")
  );`,
}
