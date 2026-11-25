# AI Radar for iPhone and iPad

AI Radar shows three picks for each Arena category. **Frontier** is the highest available Arena result, **ChatGPT Plus** is the best match for that plan, and **Free** is the best match for free consumer access. Each pick keeps its rank on the original leaderboard. The existing Scriptable widget can run alongside the native app while you move your Home Screen setup over.

## Build on a Mac

Use Xcode 26.3 to match the GitHub workflow, or a newer version with support for your device. The native app and WidgetKit extension target iOS and iPadOS 17 or later. Run these commands from the repository root.

```sh
xcodebuild -project native/AIRadar.xcodeproj -scheme AIRadar \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath /tmp/airadar-build CODE_SIGNING_ALLOWED=NO build
open -a Simulator
```

Boot an iPhone simulator in Simulator, then install the app and launch it once before adding a widget.

```sh
xcrun simctl install booted /tmp/airadar-build/Build/Products/Debug-iphonesimulator/AIRadar.app
xcrun simctl launch booted com.shayanhaider.airadar
```

If multiple simulators are booted, substitute the intended device UUID for `booted`. Run the native tests against a simulator UUID from `xcrun simctl list devices available`.

```sh
xcodebuild -project native/AIRadar.xcodeproj -scheme AIRadar \
  -destination 'platform=iOS Simulator,id=<simulator UUID>' \
  CODE_SIGNING_ALLOWED=NO test
```

## Install on iPhone or iPad

1. Open `native/AIRadar.xcodeproj` in Xcode. In **Signing & Capabilities**, enable automatic signing and select the same Apple Developer team for `AIRadar` and `AIRadarWidget`.
2. Register the App Group `group.com.shayanhaider.airadar` for both targets. If your team needs its own identifiers, set `AIRADAR_BUNDLE_ID` and `AIRADAR_APP_GROUP` in `native/Configuration/Base.xcconfig` and use the resulting App Group on both targets. The App Group lets the app and the widget share rankings, access settings, and the last valid cache.
3. Select the `AIRadar` scheme and your connected iPhone or iPad as the run destination. Run from Xcode and launch AI Radar once. Follow Xcode's prompts for device trust and Developer Mode if required.

If Xcode reports that your team cannot provision App Groups, you can preview per-widget editing on your device by removing the App Groups capability and clearing **Code Signing Entitlements** for both targets in your local copy. The app and widget then have separate caches, so app refreshes and imported overrides stay in the app.

## Add and edit widgets

1. Touch and hold the Home Screen and choose **Edit → Add Widget**. Add **AI Radar** for the small or medium size, or **AI Radar Board** for the large size.
2. Touch and hold the individual widget and choose **Edit Widget**. For small and medium, choose **Category**. The default is Search. Add another widget of the same size and choose a different category to see both at once.
3. For the board, set **Row 1** through **Row 5** in the order you want. Clear unused rows and change the category assignments to reorder. Use **Use Default Rows** to show Work Capability, Overall Text, Documents, Search, and Image Generation. Turning the switch off restores that board's custom selections.

iOS saves configuration per widget. The edited value appears in the system editor. Home Screen rendering follows the WidgetKit refresh schedule. A small widget tap opens the category in AI Radar so you can choose a model. Medium and large widgets provide links directly to the relevant provider or product. Exact model preselection depends on what that provider supports.

On a compatible Mac signed in to the same Apple Account, enable **System Settings → Desktop & Dock → Use iPhone widgets**. Keep your iPhone nearby or on the same Wi-Fi network and look in the Mac widget gallery. [Apple's guide to iPhone widgets on Mac](https://support.apple.com/guide/mac-help/add-and-customize-widgets-mchl52be5da5/mac)

## Bring over Scriptable settings

Scriptable keeps `AI-Radar/settings.json` in its local documents folder. To export it, run this in a temporary script in Scriptable and choose a destination in Files. This reads your existing settings and leaves the original file in place. [Scriptable export documentation](https://docs.scriptable.app/documentpicker/#export)

```javascript
const files = FileManager.local();
const radar = files.joinPath(files.documentsDirectory(), "AI-Radar");
await DocumentPicker.export(files.joinPath(radar, "settings.json"));
```

In the native app, choose **Data and access details → Import model overrides** and select `settings.json`. The app shows how many overrides it imported and lists your old large widget order so you can re-enter it on a board. The file carries model display names and eligible chat overrides. The old file lacked a category scope, so those overrides apply only to chat. Re-select the category for each native widget using **Edit Widget**. iOS stores those selections separately from Scriptable profiles and slots. The native app starts with a bundled snapshot and builds its own cache.

## Source and coverage

The app uses the same published feed and monthly collector as Scriptable. Rankings come from Arena's official dataset and identified leaderboard snapshots. The app checks the published feed daily in UTC when it has an opportunity, and a failed refresh retains the last valid snapshot. Category details show publication dates and available coverage. [Arena leaderboards](https://arena.ai/leaderboard) · [Arena dataset](https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset)

The November 25, 2026 feed contains all 45 Search results from Arena's November 19 downloadable release. An existing Scriptable cache with the partial Search snapshot dated November 20 may keep that snapshot until a newer Arena release is published. Alignment has all 68 published ranks from a manually refreshed official site snapshot dated November 24. That snapshot contains display names, so exact model access remains unverified for Alignment. Work Capability uses Arena's `agent_capability:work` category. The separate Work Index is unavailable in this feed. Reasoning uses Arena's Hard Prompts category as a proxy.

The separate access registry records exact models, usage scopes, and supporting evidence. Eligibility verification is incomplete across ranked models. A question mark indicates a candidate whose access is uncertain. A dash indicates that the available data or access evidence did not support a pick. [Published feed](../data/widget.json) · [Access registry](../data/access.json)

## Device verification

The build and test commands cover compilation and native logic. Run the checks below on a signed device to verify WidgetKit configuration, typography, hit targets, and Liquid Glass rendering.

| Device and sizes | Checks |
| --- | --- |
| iPhone, small and medium | Add two of each size, set different categories, and add a third small widget. Change one selected category and verify the others retain theirs after relaunch, device restart, and data refresh. Leave a selection picker without choosing and verify the previous category stays set. Check long names, the compact small-widget tap flow, medium provider links, and category details. |
| iPhone, large | Add two boards with different rows. Change row order, clear optional rows, and reset one board to its default. Verify the second board keeps its rows and confirm that row links open the intended products. |
| iPhone, all sizes | Check standard, Clear, and Tinted Home Screen appearances where available. Repeat on a second display size and with larger text. Check that rank, tier, and model remain readable and intentional tap targets remain usable. |
| iPad, all sizes | Repeat independent editing, layout, and link checks on iPadOS. |
| Compatible Mac | Try adding the iPhone widgets when iPhone widgets are available on the Mac. Check category display and links. The Xcode project builds an iOS and iPadOS app. |
| Signed device, offline recovery | Load a valid published feed, go offline, and confirm the same dated ranks remain visible. Restore connectivity and confirm an updated dataset can reach the widgets. |
