# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Tampermonkey userscript** that enhances the property management experience on Torn.com. The entire application is contained in a single JavaScript file (`PropertyChecker.js`) that runs as a browser userscript.

## Architecture

### Single-File Structure
- **PropertyChecker.js**: Contains the entire application logic including:
  - CSS styles defined as JavaScript constants
  - API integration with Torn.com's REST API
  - DOM manipulation and UI creation
  - Local storage management for persistence
  - Event handling and navigation observers

### Key Components
- **Styles System**: All CSS is defined in the `STYLES` constant with nested objects for different UI sections
- **API Layer**: Direct fetch calls to endpoints using `CONFIG.API_ENDPOINT` with error handling
- **Property Data Processing**: Transforms API responses into displayable property objects
- **Pagination System**: Client-side pagination displaying 15 properties per page
- **Local Storage**: Manages API keys, offer tracking, and user preferences
- **Mutation Observers**: Handles React navigation changes and form auto-filling

### Core Features
- Property table with filtering (by status, player ID)
- Offer tracking with localStorage persistence
- Auto-refresh protection (1-minute cooldown)
- Revenue statistics and ROI calculator
- Responsive mobile design
- Auto-fill functionality for rental forms

## Development Notes

### No Build System
This project has no package.json, build tools, or dependencies - it's a pure JavaScript userscript that runs directly in the browser via Tampermonkey.

### API Integration
- Uses Torn.com API v2 with personal API keys
- Implements pagination for large property datasets (100+ properties per batch)
- Stores API keys in browser localStorage
- Handles rate limiting and error responses

### State Management
- All state is managed through localStorage
- Property offer status is tracked per-property with keys like `property_offer_${id}`
- User preferences (filters, settings) persist across sessions

### DOM Manipulation
- Creates entire UI through string templates and `insertAdjacentHTML`
- Uses mutation observers to detect navigation changes in Torn's React app
- Implements custom event handlers for all interactive elements

### Mobile Responsiveness
- Uses CSS media queries embedded in JavaScript strings
- Transforms table layout to card-based layout on mobile devices
- Adjusts button sizing and layout for touch interfaces

## Common Tasks

Since this is a userscript, there are no traditional build/test commands. Development involves:

1. **Testing**: Install in Tampermonkey and test on torn.com/properties.php
2. **Deployment**: Update version number in userscript header and upload to GreasyFork
3. **Debugging**: Use browser console to inspect localStorage state and API responses

## Code Patterns

- Functions are defined as `function name()` rather than arrow functions
- CSS-in-JS pattern using string constants
- Event delegation and cleanup to prevent memory leaks
- Debounced functions for performance optimization
- Fragment-based DOM updates for better performance