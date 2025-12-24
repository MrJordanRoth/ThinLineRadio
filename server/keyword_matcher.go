// Copyright (C) 2025 Thinline Dynamic Solutions
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT EVEN THE IMPLIED WARRANTY OF MERCHANTABILITY or FITNESS
// FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
// more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>

package main

import (
	"regexp"
	"strings"
)

// KeywordMatch represents a matched keyword in a transcript
type KeywordMatch struct {
	Keyword  string
	UserId   uint64
	Context  string // Surrounding text (50 chars each side)
	Position int    // Character position in transcript
	CallId   uint64
}

// KeywordMatcher handles keyword matching in transcripts
type KeywordMatcher struct {
	contextChars int // Number of characters to include on each side of match
}

// NewKeywordMatcher creates a new keyword matcher
func NewKeywordMatcher() *KeywordMatcher {
	return &KeywordMatcher{
		contextChars: 50, // Default: 50 chars each side
	}
}

// MatchKeywords matches keywords against a transcript (case-insensitive, whole-word only)
// Transcript should already be in ALL CAPS
func (matcher *KeywordMatcher) MatchKeywords(transcript string, keywords []string) []KeywordMatch {
	matches := []KeywordMatch{}
	
	if transcript == "" || len(keywords) == 0 {
		return matches
	}
	
	// Ensure transcript is uppercase
	transcriptUpper := strings.ToUpper(transcript)
	
	for _, keyword := range keywords {
		if keyword == "" {
			continue
		}
		
		// Convert keyword to uppercase for case-insensitive matching
		keywordUpper := strings.ToUpper(strings.TrimSpace(keyword))
		
		// Escape special regex characters in keyword
		keywordEscaped := regexp.QuoteMeta(keywordUpper)
		
		// Create regex pattern for whole-word matching
		// \b matches word boundaries (between word and non-word characters)
		pattern := `\b` + keywordEscaped + `\b`
		re, err := regexp.Compile(pattern)
		if err != nil {
			// If regex compilation fails, fall back to simple substring matching
			// but still check word boundaries manually
			pos := 0
			for {
				index := strings.Index(transcriptUpper[pos:], keywordUpper)
				if index == -1 {
					break
				}
				
				actualPos := pos + index
				
				// Check if it's a whole word match
				if matcher.isWholeWord(transcriptUpper, actualPos, len(keywordUpper)) {
					// Extract context (surrounding text)
					context := matcher.extractContext(transcript, actualPos, len(keywordUpper))
					
					matches = append(matches, KeywordMatch{
						Keyword:  keyword, // Store original keyword (not uppercase)
						Context:  context,
						Position: actualPos,
					})
				}
				
				pos = actualPos + 1
			}
			continue
		}
		
		// Find all whole-word matches using regex
		allMatches := re.FindAllStringIndex(transcriptUpper, -1)
		for _, match := range allMatches {
			actualPos := match[0]
			
			// Extract context (surrounding text)
			context := matcher.extractContext(transcript, actualPos, len(keywordUpper))
			
			matches = append(matches, KeywordMatch{
				Keyword:  keyword, // Store original keyword (not uppercase)
				Context:  context,
				Position: actualPos,
			})
		}
	}
	
	return matches
}

// isWholeWord checks if a substring at the given position is a whole word
// (not preceded or followed by alphanumeric characters)
func (matcher *KeywordMatcher) isWholeWord(text string, pos int, length int) bool {
	// Check character before the match
	if pos > 0 {
		charBefore := text[pos-1]
		if (charBefore >= 'A' && charBefore <= 'Z') || (charBefore >= 'a' && charBefore <= 'z') || (charBefore >= '0' && charBefore <= '9') {
			return false
		}
	}
	
	// Check character after the match
	if pos+length < len(text) {
		charAfter := text[pos+length]
		if (charAfter >= 'A' && charAfter <= 'Z') || (charAfter >= 'a' && charAfter <= 'z') || (charAfter >= '0' && charAfter <= '9') {
			return false
		}
	}
	
	return true
}

// extractContext extracts surrounding text from a transcript
func (matcher *KeywordMatcher) extractContext(transcript string, position int, keywordLength int) string {
	start := position - matcher.contextChars
	if start < 0 {
		start = 0
	}
	
	end := position + keywordLength + matcher.contextChars
	if end > len(transcript) {
		end = len(transcript)
	}
	
	context := transcript[start:end]
	
	// Add ellipsis if we truncated
	if start > 0 {
		context = "..." + context
	}
	if end < len(transcript) {
		context = context + "..."
	}
	
	return context
}

