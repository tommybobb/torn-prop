# Torn Properties Manager

A Tampermonkey userscript that enhances the property management experience on Torn.com by adding a comprehensive properties table with filtering and tracking capabilities.

## Features

- **Interactive Properties Table**: Displays all your properties in an organized, collapsible table
- **Property Status Tracking**: 
  - Color-coded status indicators
  - Visual alerts for properties nearing expiration
  - Tracks when rental offers have been made
- **Pagination**: Displays 15 properties per page with easy navigation
- **Auto-Refresh Protection**: Prevents excessive API calls with a 1-minute cooldown
- **Quick Actions**: Direct links to renew properties
- **Persistent Settings**: Saves your API key and offer tracking data locally

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) for your browser
2. Click [here](https://greasyfork.org/en/scripts/522408-torn-properties-manager) to install the script 
3. Visit [Torn's properties page](https://www.torn.com/properties.php)
4. Enter your API key when prompted (only required once)

## Usage

- Click the "Properties Manager" header to expand/collapse the table
- Use Previous/Next buttons to navigate through your properties
- Click the Refresh button to update property data (1-minute cooldown)
- Properties are automatically color-coded based on their status:
  - Green background: Offer made
  - Red background: Expired
  - Orange background: Warning (≤10 days remaining)
  - White background: Normal status

## Configuration

The script automatically stores your API key in localStorage. To reset:
1. Clear your browser's localStorage for torn.com
2. Refresh the page
3. Enter your new API key when prompted

## Privacy & Security

- Your API key is stored locally in your browser
- No data is transmitted to external servers
- All API calls are made directly to torn.com

## Contributing

Feel free to submit issues and enhancement requests!

## License

[MIT License](LICENSE)

## Author

Created by beans_ [174079]

## Changelog

### Version 1.0
- Initial release
- Basic property management features
- Offer tracking system
- Pagination implementation
