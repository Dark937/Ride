# Tick Saving Across Settings Panels (MongoDB Backend)

## 1. Appearance Page ✅
- [x] MongoDB `User` schema fields: `theme`, `reduceMotion`, `lang`
- [x] `/api/profile PATCH` saves them
- [x] Frontend calls API on toggle
- [x] Remove `server-fallback.js`
- [ ] Live test toggles persist via MongoDB

## 2. Notifications Page ⏳
- [ ] Add localStorage save for notification toggles (`#nPush`, `#nSms`, etc.)
- [ ] Add to `User` schema if missing
- [ ] Extend `/api/profile PATCH` 
- [ ] Add to settings.js save handler

## 3. Privacy Page ⏳
- [ ] Add localStorage save for privacy toggles (`#privShare`, etc.)
- [ ] Add to `User` schema if missing
- [ ] Extend `/api/profile PATCH`
- [ ] Add to settings.js save handler

✅ **Notifications/Privacy** complete — `notifPrefs`/`privacyPrefs` → MongoDB `User` docs

