# Alert.Swiss

A [TRMNL](https://trmnl.com) community plugin that brings current official
Swiss public warnings from [Alertswiss](https://www.alert.swiss/) to ePaper
displays.

<img width="150" alt="Works with TRMNL" src="https://trmnl.com/images/brand/badges/light/works-with-trmnl/trmnl-badge-works-with-light.svg" />

## What it does

Alert.Swiss provides a quiet, glanceable overview of active warnings:

- filter alerts by one or more canton codes, such as `ZH,SG,SH`
- use `CH` to show alerts from all cantons
- always include nationwide alerts
- choose the maximum number of alerts displayed

The plugin retrieves its warning data directly from the official
[Alertswiss](https://www.alert.swiss/) service.

## Data reliability

Alertswiss currently rejects requests from some cloud-hosted polling services.
To keep the recipe reliable, a scheduled GitHub Action retrieves the official
Alertswiss feed every 15 minutes and updates [`data/alerts.json`](data/alerts.json)
only when the alert content changes. TRMNL polls this public mirror instead of
calling Alertswiss directly.

The official Alertswiss feed remains the sole data source.
## TRMNL recipe

The recipe is maintained through
[TRMNL GitHub Sync](https://help.trmnl.com/en/articles/15977899-github-sync).
Its templates and settings are stored in [`src/`](src/).

## Develop locally

Preview the recipe with [trmnlp](https://github.com/usetrmnl/trmnlp):

```sh
gem install trmnl_preview
trmnlp serve
```

## License

The original plugin templates, visual design, markup, and data-parsing logic are
licensed under the [Creative Commons Attribution 4.0 International License](LICENSE),
in accordance with the
[TRMNL Community Plugin License](https://trmnl.com/plugin-license).

© 2026 Michael Kurath. Alertswiss names, data, and branding remain the property
of their respective rights holders and are not covered by this license.
