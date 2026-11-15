# Integration references

## Website
```html
<link rel="icon" type="image/svg+xml" href="/assets/brand/favicon.svg">
<link rel="icon" sizes="any" href="/assets/brand/favicon.ico">
<link rel="apple-touch-icon" href="/assets/brand/apple-touch-icon.png">
<meta property="og:image" content="https://YOUR_DOMAIN/assets/brand/open-graph-1200x630.png">
<img src="/assets/brand/positive-percy-horizontal-full.svg" alt="Positive Percy" width="240" />
```

## Web app / PWA
```json
{"icons":[
 {"src":"/icons/icon-192.png","sizes":"192x192","type":"image/png","purpose":"any"},
 {"src":"/icons/icon-512.png","sizes":"512x512","type":"image/png","purpose":"any"},
 {"src":"/icons/maskable-512.png","sizes":"512x512","type":"image/png","purpose":"maskable"}
]}
```

## iOS
Use `04_App_Icons/iOS/AppIcon-1024.png` as the source for the app-store icon catalog. Do not supply transparent store icons.

## Android
Use `04_App_Icons/Android/ic_launcher-192.png` and `ic_launcher-512.png` for ordinary launcher assets. For adaptive icons provide separate foreground and solid purple background at 432px; preserve the foreground safe area when the Android resource compiler scales.

## Other
Logotype is vectorized from the approved wordmark as shapes, so no installed font is needed to render the logos consistently. Body and heading fonts are handled by the separate brand style guide.
