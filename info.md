# Crow Light Slider Card

Crow Light Slider Card is a Lovelace card for Home Assistant lights with a **liquid-glass** look and feel. Drag sideways anywhere on the card to dim, tap the icon to switch the light on or off, and tap the card for the details. The fill and icon take on the light's own colour.

> ✨ **AI features are optional and off by default.** To unlock them, turn on **Enable AI features** in the editor's AI Features section. They need a Google Gemini conversation agent. With AI off, everything else in the card works as normal.

## Key Features

- **Three Layouts**: Live Activity, Tile and Square
- **Drag to Dim**: slide sideways anywhere on the card to set the brightness
- **Tap the Icon to Switch**: the rest of the card opens the details sheet
- **Follows the Light's Colour**: coloured lights show their own colour, and white lights use yours
- **Your Own Icon**: any Home Assistant icon, the light's own icon, or no icon at all
- **Details Sheet**: an on/off timeline from 1 to 24 hours, with a tap-or-drag readout and on-time summary
- **Text Options**: left, centre or right alignment, with an adjustable font size and card height
- **Glass Style**: Auto, Light or Dark theme with a Clear-to-Frosted slider
- **Compact or Regular Size**: Compact matches standard widget sizing
- **Animations**: Subtle, Full, Off or System (respects your device's Reduce Motion setting)
- **Colour Presets**: Sunshine, Amber, Sky, Mint, Berry and Rose, plus optional unlit, text and icon colours

## AI Features

These are all optional, and each one can be switched off individually. Long-press the card to open them:

- **Insight**: what the light's current state means, with a practical tip
- **Ask AI**: plain-English questions about the light
- **What happened?**: the latest activity as a timeline, with a short summary
- **This week**: seven days of history as a few key numbers, with a short summary

To set up Google Gemini, enable the **Generative Language API** in Google Cloud Console and add the **Google Generative AI** integration with your API key. Then select **Google AI Conversation** as the card's Conversation agent. Full step-by-step setup is in the README.

## Installation

1. Add `https://github.com/jamesmcginnis/crow-light-slider-card` as a **Dashboard** custom repository in HACS
2. Search for **Crow Light Slider Card** and click **Download**
3. Hard-refresh your browser, or close and reopen the HA app on your phone
4. Add the **Crow Light Slider Card** to a dashboard

To install manually instead, copy `crow-light-slider-card.js` from the [Releases](../../releases/latest) page into `/config/www/`. Then add `/local/crow-light-slider-card.js` as a **JavaScript module** resource.

## Quick Start

```yaml
type: custom:crow-light-slider-card
entity: light.living_room
layout: pill
appearance: auto
glass: 50
ai_features_enabled: true
ai_conversation_agent: conversation.google_generative_ai
```

> **Note:** Everything above can be set from the visual editor. AI features are **off by default**. The example above enables them; leave `ai_features_enabled` out (or set it to `false`) for a card with no AI.
