// Copyright (C) 2025 Thinline Dynamic Solutions
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

import (
	"encoding/json"
	"fmt"
	"time"
)

// SystemAlert represents a system-level alert for administrators
type SystemAlert struct {
	Id        uint64 `json:"id"`
	AlertType string `json:"alertType"` // "transcription_failure", "tone_detection_issue", "service_health", "manual"
	Severity  string `json:"severity"`  // "info", "warning", "error", "critical"
	Title     string `json:"title"`
	Message   string `json:"message"`
	Data      string `json:"data"` // JSON data for additional context
	CreatedAt int64  `json:"createdAt"`
	CreatedBy uint64 `json:"createdBy"` // User ID who created it (0 for system-generated)
	Dismissed bool   `json:"dismissed"`
}

// SystemAlertData represents the parsed Data field
type SystemAlertData struct {
	CallId      uint64 `json:"callId,omitempty"`
	SystemId    uint64 `json:"systemId,omitempty"`
	TalkgroupId uint64 `json:"talkgroupId,omitempty"`
	Error       string `json:"error,omitempty"`
	Count       int    `json:"count,omitempty"`
	Service     string `json:"service,omitempty"`
}

// CreateSystemAlert creates a new system alert
func (controller *Controller) CreateSystemAlert(alertType, severity, title, message string, data *SystemAlertData, createdBy uint64) error {
	var dataJSON string
	if data != nil {
		b, err := json.Marshal(data)
		if err != nil {
			dataJSON = "{}"
		} else {
			dataJSON = string(b)
		}
	} else {
		dataJSON = "{}"
	}

	createdAt := time.Now().UnixMilli()

	var query string
	if createdBy > 0 {
		query = fmt.Sprintf(`INSERT INTO "systemAlerts" ("alertType", "severity", "title", "message", "data", "createdAt", "createdBy") VALUES ('%s', '%s', '%s', '%s', '%s', %d, %d)`,
			escapeQuotes(alertType), escapeQuotes(severity), escapeQuotes(title), escapeQuotes(message), escapeQuotes(dataJSON), createdAt, createdBy)
	} else {
		query = fmt.Sprintf(`INSERT INTO "systemAlerts" ("alertType", "severity", "title", "message", "data", "createdAt") VALUES ('%s', '%s', '%s', '%s', '%s', %d)`,
			escapeQuotes(alertType), escapeQuotes(severity), escapeQuotes(title), escapeQuotes(message), escapeQuotes(dataJSON), createdAt)
	}

	if _, err := controller.Database.Sql.Exec(query); err != nil {
		return fmt.Errorf("failed to create system alert: %v", err)
	}

	controller.Logs.LogEvent(LogLevelInfo, fmt.Sprintf("System alert created: [%s] %s - %s", severity, title, message))

	// Send push notification to all system admins
	go controller.SendSystemAlertNotification(title, message, alertType, severity, dataJSON)

	return nil
}

// SendSystemAlertNotification sends a push notification for system alerts
// Manual alerts (sent by admins) go to all verified users
// Health monitoring alerts only go to system admins
func (controller *Controller) SendSystemAlertNotification(title, message, alertType, severity, dataJSON string) {
	var query string
	var targetDescription string
	
	if alertType == "manual" {
		// Manual alerts: send to ALL verified users
		query = `SELECT "userId" FROM "users" WHERE "verified" = true`
		targetDescription = "verified users"
	} else {
		// Health/monitoring alerts: only send to system admins
		query = `SELECT "userId" FROM "users" WHERE "systemAdmin" = true`
		targetDescription = "system admins"
	}
	
	rows, err := controller.Database.Sql.Query(query)
	if err != nil {
		controller.Logs.LogEvent(LogLevelError, fmt.Sprintf("failed to get %s: %v", targetDescription, err))
		return
	}
	defer rows.Close()

	var targetUserIds []uint64
	for rows.Next() {
		var userId uint64
		if err := rows.Scan(&userId); err != nil {
			continue
		}
		targetUserIds = append(targetUserIds, userId)
	}

	if len(targetUserIds) == 0 {
		controller.Logs.LogEvent(LogLevelWarn, fmt.Sprintf("no %s found to send system alert notification", targetDescription))
		return
	}

	// Get device tokens for target users
	var playerIds []string
	for _, userId := range targetUserIds {
		tokens := controller.DeviceTokens.GetByUser(userId)
		for _, token := range tokens {
			if token.Token != "" {
				playerIds = append(playerIds, token.Token)
			}
		}
	}

	if len(playerIds) == 0 {
		controller.Logs.LogEvent(LogLevelWarn, fmt.Sprintf("no device tokens found for %s", targetDescription))
		return
	}

	// Determine icon and sound based on severity
	icon := "🔔"
	sound := "startup.wav"
	switch severity {
	case "critical":
		icon = "🚨"
		sound = "startup.wav" // Could be customized per severity
	case "error":
		icon = "❌"
		sound = "startup.wav"
	case "warning":
		icon = "⚠️"
		sound = "startup.wav"
	case "info":
		icon = "ℹ️"
		sound = "startup.wav"
	}

	// Group player IDs by platform (if we had platform info, but we don't store it in device tokens lookup)
	// For now, send to all devices using the batch system
	notificationTitle := fmt.Sprintf("%s System Alert", icon)
	
	// Send to all player IDs at once
	// The relay server will handle the actual platform-specific formatting
	if len(playerIds) > 0 {
		go controller.sendNotificationBatch(playerIds, notificationTitle, title, message, "android", sound, nil, "", "")
		controller.Logs.LogEvent(LogLevelInfo, fmt.Sprintf("[%s] system alert notification sent to %d device(s) (%s)", alertType, len(playerIds), targetDescription))
	}
}

// GetSystemAlerts retrieves system alerts (optionally filtered by dismissed status)
func (controller *Controller) GetSystemAlerts(limit int, includeDismissed bool) ([]*SystemAlert, error) {
	if limit <= 0 {
		limit = 50
	}
	if limit > 500 {
		limit = 500
	}

	var query string
	if includeDismissed {
		query = fmt.Sprintf(`SELECT "alertId", "alertType", "severity", "title", "message", "data", "createdAt", COALESCE("createdBy", 0), "dismissed" FROM "systemAlerts" ORDER BY "createdAt" DESC LIMIT %d`, limit)
	} else {
		query = fmt.Sprintf(`SELECT "alertId", "alertType", "severity", "title", "message", "data", "createdAt", COALESCE("createdBy", 0), "dismissed" FROM "systemAlerts" WHERE "dismissed" = false ORDER BY "createdAt" DESC LIMIT %d`, limit)
	}

	rows, err := controller.Database.Sql.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to query system alerts: %v", err)
	}
	defer rows.Close()

	var alerts []*SystemAlert
	for rows.Next() {
		alert := &SystemAlert{}
		if err := rows.Scan(&alert.Id, &alert.AlertType, &alert.Severity, &alert.Title, &alert.Message, &alert.Data, &alert.CreatedAt, &alert.CreatedBy, &alert.Dismissed); err != nil {
			continue
		}
		alerts = append(alerts, alert)
	}

	return alerts, nil
}

// DismissSystemAlert marks a system alert as dismissed
func (controller *Controller) DismissSystemAlert(alertId uint64) error {
	query := fmt.Sprintf(`UPDATE "systemAlerts" SET "dismissed" = true WHERE "alertId" = %d`, alertId)
	if _, err := controller.Database.Sql.Exec(query); err != nil {
		return fmt.Errorf("failed to dismiss system alert: %v", err)
	}
	return nil
}

// MonitorTranscriptionFailures monitors for transcription failures and creates system alerts
func (controller *Controller) MonitorTranscriptionFailures() {
	// Check for calls that have failed transcription
	twentyFourHoursAgo := time.Now().Add(-24 * time.Hour).UnixMilli()
	
	query := fmt.Sprintf(`SELECT COUNT(*) FROM "calls" WHERE "transcriptionStatus" = 'failed' AND "timestamp" >= %d`, twentyFourHoursAgo)
	
	var failureCount int
	if err := controller.Database.Sql.QueryRow(query).Scan(&failureCount); err != nil {
		controller.Logs.LogEvent(LogLevelError, fmt.Sprintf("failed to check transcription failures: %v", err))
		return
	}

	// If we have more than 10 failures in last 24 hours, create an alert
	if failureCount >= 10 {
		data := &SystemAlertData{
			Count:   failureCount,
			Service: "transcription",
		}
		
		controller.CreateSystemAlert(
			"transcription_failure",
			"warning",
			"Transcription Service Issues",
			fmt.Sprintf("%d transcription failures detected in the last 24 hours. Check Whisper service status.", failureCount),
			data,
			0, // System-generated
		)
	}
}

// MonitorToneDetectionIssues monitors for tone detection problems
func (controller *Controller) MonitorToneDetectionIssues() {
	// Check if any talkgroups with tone detection enabled haven't detected tones recently
	twentyFourHoursAgo := time.Now().Add(-24 * time.Hour).UnixMilli()
	
	// Get talkgroups with tone detection enabled
	query := `SELECT "talkgroupId", "label", "systemId" FROM "talkgroups" WHERE "toneDetectionEnabled" = true`
	rows, err := controller.Database.Sql.Query(query)
	if err != nil {
		controller.Logs.LogEvent(LogLevelError, fmt.Sprintf("failed to check tone detection: %v", err))
		return
	}
	defer rows.Close()

	for rows.Next() {
		var talkgroupId, systemId uint64
		var label string
		if err := rows.Scan(&talkgroupId, &label, &systemId); err != nil {
			continue
		}

		// Check if this talkgroup has had any calls with tones in the last 24 hours
		checkQuery := fmt.Sprintf(`SELECT COUNT(*) FROM "calls" WHERE "talkgroupId" = %d AND "hasTones" = true AND "timestamp" >= %d`, talkgroupId, twentyFourHoursAgo)
		
		var toneCount int
		if err := controller.Database.Sql.QueryRow(checkQuery).Scan(&toneCount); err != nil {
			continue
		}

		// Also check if there have been ANY calls on this talkgroup
		callCountQuery := fmt.Sprintf(`SELECT COUNT(*) FROM "calls" WHERE "talkgroupId" = %d AND "timestamp" >= %d`, talkgroupId, twentyFourHoursAgo)
		
		var callCount int
		if err := controller.Database.Sql.QueryRow(callCountQuery).Scan(&callCount); err != nil {
			continue
		}

		// Only alert if there have been calls but no tones (might indicate tone detection issue)
		if callCount >= 5 && toneCount == 0 {
			data := &SystemAlertData{
				TalkgroupId: talkgroupId,
				SystemId:    systemId,
				Count:       callCount,
			}
			
			controller.CreateSystemAlert(
				"tone_detection_issue",
				"info",
				"No Tones Detected",
				fmt.Sprintf("Talkgroup '%s' has tone detection enabled but no tones detected in %d calls over 24 hours.", label, callCount),
				data,
				0, // System-generated
			)
		}
	}
}

// StartSystemHealthMonitoring starts periodic system health checks
func (controller *Controller) StartSystemHealthMonitoring() {
	ticker := time.NewTicker(1 * time.Hour) // Check every hour
	go func() {
		for range ticker.C {
			controller.MonitorTranscriptionFailures()
			controller.MonitorToneDetectionIssues()
		}
	}()
	
	controller.Logs.LogEvent(LogLevelInfo, "system health monitoring started")
}

