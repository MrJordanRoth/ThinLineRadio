# Delay System Documentation

## Overview

ThinLine Radio includes a comprehensive delay system that allows administrators to control the timing of live audio streaming to clients. This system is designed for compliance with broadcasting regulations, emergency response coordination, and other scenarios where delayed audio transmission is required.

## What is the Delay System?

The delay system **delays live audio streaming to clients** by holding audio calls in a buffer before sending them to connected clients. This is **NOT** a recording delay - calls are still recorded and stored immediately when received.

### Key Points:
- **Stream Delay Only**: Affects live audio streaming, not recording or storage
- **Time Unit**: All delays are specified in **MINUTES**
- **Client Impact**: Clients receive audio after the specified delay period
- **Real-time**: Changes take effect immediately for new calls

## How It Works

### 1. Call Reception
When a call is received by ThinLine Radio:
1. Call is immediately recorded and stored in the database
2. Call metadata is processed (system, talkgroup, units, etc.)
3. Delay calculation begins

### 2. Delay Calculation
The system uses a **priority-based delay system**:

```
Priority 1: Talkgroup Delay (highest)
Priority 2: System Delay (medium)  
Priority 3: Default System Delay (lowest)
```

**Example:**
- Talkgroup has delay: 10 minutes → **10 minutes used**
- No talkgroup delay, System has delay: 5 minutes → **5 minutes used**
- No talkgroup/system delay, Default: 3 minutes → **3 minutes used**
- No delays set → **0 minutes (immediate streaming)**

### 3. Audio Buffering
If a delay is calculated:
1. Call is marked as "delayed"
2. Call is stored in the delayed calls table
3. A timer is set for the calculated delay period
4. When timer expires, call is sent to all connected clients

### 4. Client Delivery
After the delay period:
1. Audio is streamed to all connected clients
2. Call appears in the live feed
3. Call can be played back immediately

**Security Note**: Delayed calls are completely blocked from all access methods (search, direct ID, playback) until their delay period expires. This prevents users from bypassing the delay system through alternative access methods.

## Configuration Options

### Default System Delay
- **Location**: Admin → Options → Default System Delay
- **Purpose**: Global fallback delay for all systems and talkgroups
- **Range**: 0 (disabled) to any positive number
- **Unit**: Minutes
- **Default**: 0 (disabled)

### Individual System Delay
- **Location**: Admin → Systems → [System] → Delay
- **Purpose**: Override default delay for specific systems
- **Priority**: Medium (overrides default, overridden by talkgroup)
- **Unit**: Minutes

### Individual Talkgroup Delay
- **Location**: Admin → Systems → [System] → Talkgroups → [Talkgroup] → Delay
- **Purpose**: Override system and default delays for specific talkgroups
- **Priority**: Highest (overrides both system and default delays)
- **Unit**: Minutes

## Use Cases

### 1. Broadcasting Compliance
Many jurisdictions require delays for live audio broadcasts to allow for:
- Content review and editing
- Emergency response coordination
- Regulatory compliance

### 2. Emergency Response
Delays can provide time for:
- Emergency personnel coordination
- Situation assessment
- Response planning

### 3. Content Moderation
Delays allow for:
- Inappropriate content filtering
- Quality control
- Content review

### 4. Testing and Development
Delays are useful for:
- Testing client behavior
- Simulating network conditions
- Development and debugging

## Technical Implementation

### Database Storage
Delayed calls are stored in the `delayed` table:
```sql
CREATE TABLE "delayed" (
    "callId" INTEGER PRIMARY KEY,
    "timestamp" INTEGER NOT NULL
);
```

### Timer Management
The system uses Go's `time.AfterFunc` to manage delays:
```go
delayer.timers[call.Id] = *time.AfterFunc(remaining, func() {
    // Timer callback - send call to clients
    go delayer.controller.Downstreams.Send(delayer.controller, call)
    go delayer.controller.Clients.EmitCall(delayer.controller, call)
})
```

### Memory Management
- Delayed calls are stored in memory with timers
- Timers are automatically cleaned up when calls are sent
- Database is used for persistence across server restarts

## Security and Bypass Prevention

### Complete Access Blocking
The delay system implements comprehensive access blocking to prevent users from bypassing delays:

- **Search Results**: Delayed calls are automatically excluded from search results
- **Direct Access**: Calls accessed by ID are blocked if currently delayed
- **Playback**: Audio playback is completely blocked for delayed calls
- **API Access**: All API endpoints respect the delay system

### User Experience
When users attempt to access delayed calls:
- **Clear Error Messages**: Server sends "ERR" websocket messages with descriptive text
- **Client Display**: Frontend displays user-friendly error messages
- **Informative Content**: Messages explain why the call is not accessible
- **Real-time Feedback**: Users immediately understand the delay status

### Why This Matters
- **Compliance**: Ensures broadcasting regulations are enforced
- **Emergency Response**: Prevents premature information disclosure
- **Content Control**: Maintains intended delay periods regardless of access method
- **System Integrity**: Delays cannot be circumvented through technical means

## Performance Considerations

### Memory Usage
- Each delayed call consumes memory for the timer and call data
- Large numbers of delayed calls may impact performance
- Consider setting reasonable delay limits

### Network Impact
- Delayed calls don't affect network bandwidth until sent
- Client connections remain active during delays
- No additional network overhead for delayed calls

### Storage Impact
- Calls are stored immediately regardless of delay
- Delay system doesn't affect database storage
- No additional storage overhead for delays

## Troubleshooting

### Common Issues

#### 1. Delays Not Working
- Check that delays are set to values > 0
- Verify the delay system is enabled
- Check server logs for error messages

#### 2. Delayed Calls Not Accessible
- **Expected Behavior**: Delayed calls are completely blocked from access
- **Search Results**: Delayed calls won't appear in search results
- **Direct Access**: Attempting to access delayed calls by ID will return an error
- **Wait Time**: Calls become accessible only after their delay period expires

#### 2. Excessive Memory Usage
- Reduce delay times for high-volume systems
- Monitor the number of delayed calls
- Consider implementing delay limits

#### 3. Client Disconnections
- Ensure clients can maintain connections during delays
- Check network stability
- Verify client timeout settings

### Debugging
Enable debug logging to see delay system activity:
```go
// In server logs, look for:
// - "delayer.delay" messages
// - Timer creation and expiration
// - Call delivery to clients
```

## Best Practices

### 1. Delay Values
- **Short Delays**: 1-5 minutes for most use cases
- **Medium Delays**: 5-15 minutes for compliance requirements
- **Long Delays**: 15+ minutes only when absolutely necessary

### 2. System Configuration
- Set reasonable default delays
- Use individual delays sparingly
- Monitor system performance

### 3. Client Communication
- Inform users about delay settings
- Explain why delays are necessary
- Provide clear expectations

### 4. Monitoring
- Track delay system performance
- Monitor memory usage
- Log delay-related activities

## API Reference

### Delay Calculation
```go
func (delayer *Delayer) getDelay(call *Call) uint
```
Returns the effective delay in minutes for a call based on priority system.

### Delay Application
```go
func (delayer *Delayer) Delay(call *Call)
```
Applies the calculated delay to a call and sets up timer for client delivery.

### Timer Management
```go
func (delayer *Delayer) Start() error
```
Restores delayed calls from database and recreates timers after server restart.

## Conclusion

The delay system provides flexible control over live audio streaming while maintaining system performance and reliability. By understanding the priority system and configuration options, administrators can effectively manage audio delays for compliance, coordination, and content control purposes.

For additional support or questions about the delay system, please refer to the main documentation or contact the development team.
