# The Web Application

## Overview

ThinLine Radio features a modern, responsive web application interface designed for monitoring and listening to radio scanner transmissions. The interface is divided into a main scanner view with an integrated alerts panel, along with several side panels for advanced functionality.

## Main Screen

The main screen consists of two primary columns:

### Left Column: Scanner Interface

The scanner interface includes three main sections:

#### Status Bar

The status bar displays:
- **Left LED**: Visual indicator showing the current audio state
  - Illuminated when there is active audio
  - Blinks if audio is paused
  - Color can be customized by system or talkgroup (default is green)
- **Branding**: Displays the configured branding text or "ThinLine Radio" by default
- **Right LED**: Additional status indicator showing connection and playback state

#### Display Area

The display area shows information about the current or last played transmission:

**Stats Row:**
- **Time**: Current time (format configurable)
- **Listeners**: Number of active listeners (if enabled) or connection status
- **Queue**: Number of audio files in the listening queue

**System/TGID Row:**
- **System**: Current system label
- **TGID**: Talkgroup ID

**Tag/ID Row:**
- **Tag**: Talkgroup tag
- **ID**: Unit ID or alias name

**Scanning Animation:**
- When live feed is active and no audio is playing, a "SCANNING" animation is displayed
- Shows the current system being scanned

**Talkgroup Container:**
- Displays the current talkgroup name in a color-coded box
- Shows a favorite star icon if the talkgroup is favorited
- Color scheme can be customized per talkgroup

**Frequency/Time Row:**
- **F**: Call frequency in MHz
- **Time**: The audio file recorded time

**Transmission History:**
- Table showing the last 10 transmissions
- Columns: Time of Call (TOC), System, Talkgroup, Name, Frequency
- Currently playing transmission is highlighted
- Double-click the display area to switch to full-screen mode

#### Control Panel

The control panel uses a grid layout with three rows of buttons:

**Row 1:**
- **LIVE FEED**: Toggle live feed mode. When active, incoming audio plays according to active systems/talkgroups. When inactive, playback mode is enabled for archived audio.
- **PAUSE**: Stop playing queue audio. Useful for answering phone calls without losing queued items. Button changes to "RESUME" when paused.
- **REPLAY LAST**: Replay the current audio from the beginning, or the previous one if none is active. Press repeatedly to replay items from the history.
- **SKIP NEXT**: Stop the current audio and play the next one in the listening queue. Useful for skipping boring or encrypted transmissions.

**Row 2:**
- **AVOID TALKGROUP**: Activate or deactivate the talkgroup from the current or previous audio. Pressing multiple times cycles through: AVOID → AVOID 30M → AVOID 60M → AVOID 120M (temporary avoidance periods).
- **ADD/REMOVE FAVORITE**: Toggle favorite status for the current talkgroup. Favorited talkgroups appear in the Favorites section of the Channel Select panel.
- **HOLD SYSTEM**: Temporarily maintain the current system in live feed mode.
- **HOLD TALKGROUP**: Temporarily maintain the current talkgroup in live feed mode.

**Row 3:**
- **PLAYBACK**: Open the search/playback panel to browse and play archived audio files.
- **ALERTS**: Open the alerts panel to view and manage keyword alerts, tone alerts, and other notifications.
- **SETTINGS**: Open the settings panel to configure preferences, delays, and other options.
- **CHANNEL SELECT**: Open the channel selection panel to choose which systems and talkgroups to monitor.

### Right Column: Recent Alerts

The right column displays a panel showing recent alerts:
- **Header**: "Recent Alerts" with a refresh button
- **Alert Items**: Each alert shows:
  - Alert type badge (keyword, tone, etc.)
  - Timestamp
  - System and talkgroup information
  - Transcript or transcript snippet (if available)
  - Matched keywords (if applicable)
  - Tone detection information (if applicable)
  - Play button to listen to the associated call

## Side Panels

### Search Panel (Playback)

The search panel allows you to browse and play archived audio files from the database.

**List Section:**
- Table displaying archived audio files with columns:
  - Control (Play/Stop/Download button)
  - Date
  - Time
  - System
  - Talkgroup
  - Tag
  - Name
  - Frequency
  - Duration
- **Playback Modes:**
  - **Live Feed Active**: Press PLAY to interrupt current playback and play the selected file. After playback finishes, the listening queue resumes.
  - **Live Feed Inactive (Playback Mode)**: Press PLAY to enter playback mode. Files play sequentially from the list. Press STOP to cancel playback mode.
- **Download Mode**: Toggle switch at the bottom left converts play buttons to download buttons for individual file downloads.
- **Pagination**: Browse through the entire database using the paginator at the bottom right (disabled during playback mode).

**Filters Section:**
- Filter archived audio by:
  - Date range
  - System
  - Talkgroup
  - Tags
  - Groups
- Change sort order
- Toggle between play and download modes
- Note: Changing any filter while in playback mode will deactivate it.

> **Note**: Playback mode requires the web app to be online, as it plays archived audio files from the database.

### Select Panel (Channel Selection)

The channel selection panel allows you to choose which systems and talkgroups to monitor in live feed mode.

**Top Section:**
- **Search Bar**: Search for talkgroups, systems, or IDs
- **Action Buttons**:
  - **Enable All / Disable All**: Toggle all talkgroups at once
  - **Systems**: Open systems filter modal
- **Stats Row**: Shows count of enabled talkgroups vs. total

**Favorites Section:**
- Displays favorited systems, tags, and talkgroups
- Quick access to commonly used channels
- Actions to enable/disable all favorites
- Expandable sections showing favorite systems with their tags and talkgroups

**Content Section:**
- **Systems List**: Hierarchical view of all systems
  - Each system can be expanded to show tags
  - Each tag can be expanded to show talkgroups
  - System header shows:
    - System label
    - Enabled count / Total count
    - Status icon (all enabled, some enabled, none enabled)
    - Toggle badge (All/Some/None)
    - Enable/Disable buttons
    - Favorite toggle
  - Tag header shows:
    - Tag icon and label (color-coded)
    - Talkgroup count
    - Status icon
    - Toggle badge
    - Enable/Disable buttons
    - Favorite toggle
  - Talkgroup chips show:
    - Talkgroup label and name
    - Talkgroup ID
    - Enabled state (highlighted when enabled)
    - Favorite toggle

**Selection Behavior:**
- Click a talkgroup chip to toggle its enabled state
- Click a system or tag header to toggle all talkgroups within it
- Use the toggle badges to quickly see and change selection status
- Favorited items appear in the Favorites section for quick access

> **Note**: The selection panel only affects live feed mode, not playback mode.

### Settings Panel

The settings panel provides configuration options for the web application:

**Live Feed Settings:**
- **Backlog (minutes)**: Configure how much prior audio to hear when enabling live feed
  - 0 minutes: Only new calls going forward (live audio only)
  - >0 minutes: Hear calls from the last N minutes when enabling live feed
  - System and talkgroup delays are always respected
- **Auto Live Feed**: Automatically start live feed when the app opens (requires PWA installation)

**Display Settings:**
- **Time Format**: Choose between 12-hour and 24-hour time format
- **Dimmer**: Enable/disable display dimming
- **Fullscreen**: Toggle fullscreen mode (also accessible by double-clicking the display area)

**Audio Settings:**
- **Volume**: Adjust playback volume
- **Audio Quality**: Configure audio quality settings

**Delay Settings:**
- **User-Specific Delay**: Configure per-user delay preferences
- **Default System Delay**: View the global system delay setting (configured in admin)

**Other Settings:**
- **Theme**: Light/Dark mode (if available)
- **Notifications**: Configure browser notification settings
- **Help**: Access help documentation

### Alerts Panel

The alerts panel allows you to view and manage alerts:

**Alert Types:**
- **Keyword Alerts**: Triggered when specified keywords are detected in transcripts
- **Tone Alerts**: Triggered when specific tone patterns are detected
- **System/Talkgroup Alerts**: Alerts for specific systems or talkgroups

**Alert Management:**
- View active alerts
- Configure alert preferences
- Set up keyword lists
- Configure tone detection settings
- View alert history

## Authentication

If authentication is required, the web app will display an authentication screen:

- **Unlock Code**: Enter the unlock code to access the scanner
- **User Login**: If user accounts are enabled, login with email and password
- **User Registration**: If registration is enabled, create a new account
- **Email Verification**: Verify your email address if required

## Subscription Management

If subscription management is enabled:

- **Subscription Lock**: Users without active subscriptions see a lock overlay
- **Checkout**: Integrated Stripe checkout for subscription management
- **Group Admin**: Group administrators can manage subscriptions for their users
- **Transfer**: Users can transfer from group-managed to personal subscriptions

## Features

### Favorites System

- Mark systems, tags, or talkgroups as favorites
- Quick access to favorites in the Channel Select panel
- Favorite status persists across sessions
- Visual indicators (star icons) throughout the interface

### Scanning Animation

- When live feed is active and no audio is playing, a scanning animation is displayed
- Shows the current system being scanned
- Provides visual feedback that the system is actively monitoring

### Fullscreen Mode

- Double-click the display area to enter fullscreen mode
- Provides an immersive viewing experience
- Exit fullscreen using the same method or the settings panel

### Responsive Design

- The web application is responsive and works on desktop, tablet, and mobile devices
- Progressive Web App (PWA) support for installation on mobile devices
- Touch-friendly controls for mobile users

### Real-time Updates

- Live feed status updates in real-time
- Queue count updates as new calls arrive
- Alert notifications appear in real-time
- Transmission history updates automatically

## Keyboard Shortcuts

(If applicable, document any keyboard shortcuts here)

## Browser Compatibility

ThinLine Radio web application is compatible with modern browsers:
- Chrome/Edge (recommended)
- Firefox
- Safari
- Opera

For best experience, use the latest version of your browser and ensure JavaScript is enabled.
