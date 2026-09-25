# Crow Light Slider Card

Crow Light Slider Card is a Lovelace card for Home Assistant lights with a **liquid-glass** look and feel. Drag sideways anywhere on the card to dim, tap the icon to switch the light on or off, and tap the card for the details. The fill and icon take on the light's own colour, and you can choose from three layouts: a slim **Live Activity** row, a compact **Tile** or a **Square**.

> 🎨 **Built to stay readable.** The light's colour is adjusted automatically so the card stays legible in both light and dark themes.

> ✨ **AI features are optional and off by default.** To unlock them, turn on **Enable AI features** in the AI Features section of the card editor. They need a Google Gemini conversation agent (see [AI Features Setup](#-ai-features-setup-optional) below). With AI off, everything else in the card works as normal.

**Add the repository to HACS:**

[![Open your Home Assistant instance and add this repository to HACS.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=jamesmcginnis&repository=crow-light-slider-card&category=plugin)

---

## 🛠️ Installation

### Via HACS (Recommended)

1. Click the **Add to HACS** button above. Alternatively, in Home Assistant open **HACS** → **⋮ menu** (top right) → **Custom repositories**
2. Add `https://github.com/jamesmcginnis/crow-light-slider-card` as a **Dashboard** repository, then close
3. Search for **Crow Light Slider Card** and click **Download**
4. Hard-refresh your browser (Cmd+Shift+R on Mac), or close and reopen the Home Assistant app on your phone
5. Edit a dashboard, click **+ Add Card** and search for **Crow Light Slider Card**

> 💡 HACS adds the dashboard resource for you, so there's nothing else to set up.

### Manual

1. Download `crow-light-slider-card.js` from [Releases](../../releases/latest)
2. Copy it into `/config/www/` on your Home Assistant instance
3. Go to **Settings → Dashboards → ⋮ menu → Resources → + Add Resource**
4. Enter `/local/crow-light-slider-card.js`, choose **JavaScript module** and click **Create**
5. Hard-refresh your browser and add the **Crow Light Slider Card** to a dashboard

---

## 🤖 AI Features Setup (Optional)

AI features are **off by default**, and the card works fully without them. To unlock them (Insight, Ask AI, What happened? and This week), turn on **Enable AI features** in the card editor's **AI Features** section, then set up Google Gemini as your conversation agent:

### Step 1 — Enable the Generative Language API

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and sign in
2. Create a new project (or select an existing one)
3. Go to **APIs & Services → Library**
4. Search for **Generative Language API** and click **Enable**

> ⚠️ This step is essential. An API key without the Generative Language API enabled will return errors immediately.

### Step 2 — Create an API Key

1. In Google Cloud Console go to **APIs & Services → Credentials**
2. Click **+ Create Credentials → API key** and copy the key

### Step 3 — Add Google Generative AI to Home Assistant

1. In Home Assistant go to **Settings → Devices & Services → + Add Integration**
2. Search for **Google Generative AI** and select it
3. Paste your API key and click Submit
4. Click the **gear icon ⚙️** next to **Google AI Conversation**
5. Uncheck **Recommended model settings**, select a current **Flash** model and save

### Step 4 — Configure the Card

1. In the card's visual editor, open the **AI Features** section and turn on **Enable AI features**
2. Select **Google AI Conversation** from the **Conversation agent** dropdown
3. Optionally, switch off any individual AI tool you don't want

AI stays off until an agent is chosen. Nothing is sent to Gemini until you open one of the AI sheets, and nothing runs in the background.

### Free Tier

Gemini's free tier is generous for a single light card. Answers are cached, so opening the same sheet again shortly afterwards doesn't use extra requests. Insight and Ask AI answers are kept for 10 minutes and What happened? summaries for 30 minutes. If you see a rate-limit error, your daily quota has run out and will reset the next day.

---

## ✨ Features

### Layouts

- 💊 **Live Activity**: one slim row you drag to dim, with an adjustable height
- 🟧 **Tile**: a compact tile with the icon and name
- ⬛ **Square**: the icon on top with the name below

### Card

- 👉 **Drag to dim**: slide a finger sideways anywhere on the card to set the brightness. Lights that can only switch on and off just switch.
- 💡 **Tap the icon** to switch the light on or off
- 🌈 **Follows the light's colour**: coloured lights show the colour they're set to, and white lights use your chosen Light colour
- 🖼️ **Your own icon**: pick any Home Assistant (Material Design Icons) icon, or use the icon Home Assistant shows for the light. You can also hide the icon altogether.
- 🔆 **Brightness readout**: shows the brightness (or "Off") under the name
- 🔤 **Text alignment and font size**: left, centre or right, with a font size from 10 to 28px
- ✋ **Long-press**: opens the actions sheet when AI features are on

### Details Sheet

Tap anywhere on the card except the icon to open it:

- 📊 **On/off timeline** with **1h, 3h, 6h, 12h or 24h** ranges, showing how long the light was on and what percentage of the period that was
- 👉 **Tap-or-drag readout**: a glass pill shows the state and time anywhere along the timeline
- 🕒 **Current state and last changed**
- 🔘 **Turn on / Turn off** button

### Appearance

- **Theme**: Auto (follows your Home Assistant theme), Light or Dark
- **Glass slider**: from Clear to Frosted. It looks best over a wallpaper or coloured view.
- **Size**: Compact, which matches standard widget sizing, or Regular, which is about 20% larger
- **Animations**: Subtle (the fill glides to its new level), Full (the icon also breathes while the light is on), Off, or System (Subtle, but stays still when your device's Reduce Motion setting is on)
- **Colour presets**: Sunshine, Amber, Sky, Mint, Berry and Rose
- **Optional colours**: an Unlit tint for the part of the card that isn't lit, plus Text and Icon colours that are used exactly as picked

### AI Features

These are all optional, and each one can be switched off individually in the editor. Long-press the card to open them:

- **Insight**: what the light's current state means, with a practical tip
- **Ask AI**: type a question about the light, or tap a suggested one
- **What happened?**: the latest activity as a timeline, with a short summary
- **This week**: seven days of history as a few key numbers, with a short summary

> 🔒 **The AI only works with facts from Home Assistant.** Each request includes the light's actual state and history, and the AI is told not to add anything that isn't in that data.

---

## 📋 Quick Start

```yaml
type: custom:crow-light-slider-card
entity: light.living_room
layout: pill
appearance: auto
glass: 50
size: compact
animation: subtle
show_icon: true
show_state: true
slider_enabled: true
follow_light_color: true
active_color: '#F1C40F'
ai_features_enabled: true
ai_conversation_agent: conversation.google_generative_ai
ai_enable_insight: true
ai_enable_ask: true
ai_enable_recap: true
ai_enable_week: true
```

> **Note:** Everything above can be set from the visual editor. AI features are **off by default**. The example above enables them; leave `ai_features_enabled` out (or set it to `false`) for a card with no AI. Your Gemini agent's entity ID may differ, so pick it from the editor's dropdown.

### Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `entity` | *(required)* | The light to dim and switch |
| `layout` | `pill` | `pill` (Live Activity), `tile` or `square` |
| `name` | *(entity name)* | Custom name for the card |
| `show_icon` | `true` | Show the icon (tap it to switch the light) |
| `icon` | *(entity icon)* | Any `mdi:` icon |
| `use_dynamic_icon` | `false` | Use the light's own icon, even if an icon is set |
| `show_state` | `true` | Show the brightness (or "Off") under the name |
| `text_align` | `left` | `left`, `center` or `right` |
| `font_size` | `14px` | Size of the name, from `10px` to `28px` |
| `card_height` | `56px` | Height of the Live Activity layout, from `40px` to `110px` |
| `slider_enabled` | `true` | Drag sideways on the card to dim |
| `follow_light_color` | `true` | Use the light's own colour when it has one |
| `graph_hours` | `3` | History range opened first: `1`, `3`, `6`, `12` or `24` |
| `appearance` | `auto` | `auto`, `light` or `dark` |
| `glass` | `50` | Glass transparency, `0` (clear) to `100` (frosted) |
| `size` | `compact` | `compact` or `regular` |
| `animation` | `subtle` | `subtle`, `full`, `off` or `system` |
| `active_color` | `#F1C40F` | Light colour, used for white lights or when `follow_light_color` is off |
| `inactive_color` | — | Optional tint for the unlit part of the card |
| `name_color` | *(automatic)* | Optional text colour |
| `icon_color` | *(automatic)* | Optional icon colour |
| `ai_features_enabled` | `false` | Master switch for all AI features |
| `ai_conversation_agent` | — | Your Google Gemini conversation agent |
| `ai_enable_insight` | `true` | Insight |
| `ai_enable_ask` | `true` | Ask AI |
| `ai_enable_recap` | `true` | What happened? |
| `ai_enable_week` | `true` | This week |

---

## 🔧 Troubleshooting

**The card doesn't appear in the card picker**
- Hard-refresh your browser, or close and reopen the Home Assistant app on your phone.
- For manual installs, check `/local/crow-light-slider-card.js` is listed under **Settings → Dashboards → Resources** as a **JavaScript module**.

**Dragging doesn't dim the light**
- Check **Drag to dim** is turned on in the editor's **Brightness slider** section.
- Lights that don't support brightness can only switch on and off, so dragging just switches them.

**Tapping the card doesn't switch the light**
- Tap the **icon** to switch. Tapping anywhere else opens the details sheet. If the icon is hidden, use the **Turn on / Turn off** button in the details sheet.

**The glass looks solid**
- Glass needs something behind it to show through. Use a dashboard wallpaper or a coloured view, and move the **Glass** slider towards Clear.

**The card isn't the colour I picked**
- With **Use the light's own colour** on, coloured lights show their own colour. Turn it off to always use your chosen Light colour.
- The Light colour is adjusted automatically to stay readable in both light and dark themes.

**AI features are missing, or long-press does nothing**
- Check **Enable AI features** is turned on in the editor's **AI Features** section. AI is off by default.
- Confirm **Google AI Conversation** is selected as the **Conversation agent**. AI stays off until one is chosen.
- Ensure the **Generative Language API** is enabled in Google Cloud Console. This is the most common setup mistake.

---

## 🙏 Credits & Acknowledgements

- The [Home Assistant](https://www.home-assistant.io) team
- The HA community for inspiration and feedback
- All users who test, report issues and suggest improvements
- My Loving Wife for her endless support ❤️

---

## 📄 License

MIT License: free to use, modify and distribute.

---

## ⭐ Support

If this is useful to you, please **star the repository** and share it with the community!

For bugs or feature requests, use the [GitHub Issues](../../issues) page.
