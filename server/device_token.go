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
	"fmt"
	"sync"
	"time"
)

type DeviceToken struct {
	Id        uint64
	UserId    uint64
	Token     string // OneSignal player ID
	Platform  string // "ios" or "android"
	Sound     string // Notification sound preference
	CreatedAt int64
	LastUsed  int64
}

type DeviceTokens struct {
	mutex      sync.RWMutex
	tokens     map[uint64]*DeviceToken // Map by device token ID
	userTokens map[uint64][]*DeviceToken // Map user ID to their devices
}

func NewDeviceTokens() *DeviceTokens {
	return &DeviceTokens{
		tokens:     make(map[uint64]*DeviceToken),
		userTokens: make(map[uint64][]*DeviceToken),
	}
}

func (dt *DeviceTokens) Load(db *Database) error {
	dt.mutex.Lock()
	defer dt.mutex.Unlock()

	rows, err := db.Sql.Query(`SELECT "deviceTokenId", "userId", "token", "platform", "sound", "createdAt", "lastUsed" FROM "deviceTokens"`)
	if err != nil {
		return err
	}
	defer rows.Close()

	dt.tokens = make(map[uint64]*DeviceToken)
	dt.userTokens = make(map[uint64][]*DeviceToken)

	tokenCount := 0
	userTokenCounts := make(map[uint64]int)

	for rows.Next() {
		token := &DeviceToken{}
		err := rows.Scan(
			&token.Id,
			&token.UserId,
			&token.Token,
			&token.Platform,
			&token.Sound,
			&token.CreatedAt,
			&token.LastUsed,
		)
		if err != nil {
			continue
		}

		dt.tokens[token.Id] = token
		dt.userTokens[token.UserId] = append(dt.userTokens[token.UserId], token)
		tokenCount++
		userTokenCounts[token.UserId]++
	}

	// Log token loading summary
	fmt.Printf("DeviceTokens.Load: loaded %d total device tokens\n", tokenCount)
	for userId, count := range userTokenCounts {
		if count > 1 {
			fmt.Printf("DeviceTokens.Load: user %d has %d device tokens\n", userId, count)
		}
	}

	return nil
}

func (dt *DeviceTokens) Add(token *DeviceToken, db *Database) error {
	dt.mutex.Lock()
	defer dt.mutex.Unlock()

	if token.CreatedAt == 0 {
		token.CreatedAt = time.Now().Unix()
	}
	if token.LastUsed == 0 {
		token.LastUsed = time.Now().Unix()
	}

	var tokenId int64
	err := db.Sql.QueryRow(
		`INSERT INTO "deviceTokens" ("userId", "token", "platform", "sound", "createdAt", "lastUsed") 
		 VALUES ($1, $2, $3, $4, $5, $6) RETURNING "deviceTokenId"`,
		token.UserId, token.Token, token.Platform, token.Sound, token.CreatedAt, token.LastUsed,
	).Scan(&tokenId)
	if err != nil {
		return err
	}

	token.Id = uint64(tokenId)
	dt.tokens[token.Id] = token
	dt.userTokens[token.UserId] = append(dt.userTokens[token.UserId], token)

	return nil
}

func (dt *DeviceTokens) Update(token *DeviceToken, db *Database) error {
	dt.mutex.Lock()
	defer dt.mutex.Unlock()

	token.LastUsed = time.Now().Unix()

	_, err := db.Sql.Exec(
		`UPDATE "deviceTokens" SET "token" = $1, "platform" = $2, "sound" = $3, "lastUsed" = $4 WHERE "deviceTokenId" = $5`,
		token.Token, token.Platform, token.Sound, token.LastUsed, token.Id,
	)
	if err != nil {
		return err
	}

	dt.tokens[token.Id] = token
	return nil
}

func (dt *DeviceTokens) Delete(id uint64, db *Database) error {
	dt.mutex.Lock()
	defer dt.mutex.Unlock()

	token, exists := dt.tokens[id]
	if !exists {
		return fmt.Errorf("device token not found")
	}

	_, err := db.Sql.Exec(`DELETE FROM "deviceTokens" WHERE "deviceTokenId" = $1`, id)
	if err != nil {
		return err
	}

	delete(dt.tokens, id)

	// Remove from userTokens map
	userTokens := dt.userTokens[token.UserId]
	for i, t := range userTokens {
		if t.Id == id {
			dt.userTokens[token.UserId] = append(userTokens[:i], userTokens[i+1:]...)
			break
		}
	}

	return nil
}

func (dt *DeviceTokens) GetByUser(userId uint64) []*DeviceToken {
	dt.mutex.RLock()
	defer dt.mutex.RUnlock()

	tokens := dt.userTokens[userId]
	if tokens == nil {
		return []*DeviceToken{} // Return empty slice instead of nil
	}
	
	// Return a copy to prevent external modification
	result := make([]*DeviceToken, len(tokens))
	copy(result, tokens)
	return result
}

func (dt *DeviceTokens) FindByUserAndToken(userId uint64, token string) *DeviceToken {
	dt.mutex.RLock()
	defer dt.mutex.RUnlock()

	for _, t := range dt.userTokens[userId] {
		if t.Token == token {
			return t
		}
	}
	return nil
}

