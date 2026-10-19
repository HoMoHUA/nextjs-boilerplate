# دارک‌مود و آمادگی وب‌اپ Arklyn Office

تاریخ: 2026-10-20، تهران؛ ادامهٔ کار روی `codex/office-studio-upgrade`، مستقل از `Office` و pushهای Hermes.

## رفتار پیاده‌شده

- از `Theme → Display mode` گزینهٔ Light / Dark / System انتخاب می‌شود. انتخاب در همان `arklyn-office-v3` ذخیره می‌شود. رنگ‌بندی cream/mint/lavender/sky مستقل می‌ماند.
- حالت تیره، رنگ زمینه و پنل/فرم/نام/پیام/مدال را با نقش‌های CSS تغییر می‌دهد. رنگ دیوارهای سه‌بعدی، tint کف و پنجره، نور اصلی و fill نیز تغییر می‌کنند؛ تصویر Canvas صرفاً فیلتر یا وارونه نمی‌شود و رنگ هویتی لباس‌ها محفوظ است.
- `Theme → Motion` شامل Follow system / Reduced motion / Full motion است. بهبودهای حرکت و محدودیت تعامل‌های آینده در [سند تعامل](CHARACTER_INTERACTIONS.fa.md) ثبت شده‌اند.
- bootstrap محلی قبل از hydration، ظاهر ذخیره‌شده یا تنظیم سیستم را اعمال می‌کند. native color-scheme، theme-color مرورگر، انتخاب متن، scrollbar و focus نیز با تم هماهنگ می‌شوند.
- manifest استاندارد با display=standalone، start_url/scope، PNGهای 192/512 و maskable، آیکون Apple 180 و viewport-fit/safe-area موجود است. `Connections` راهنمای نصب و در مرورگرهای پشتیبان، دکمهٔ Install app دارد.
- Service worker فقط navigation دفتر/ورود را network-only می‌گیرد و در خطای شبکه، صفحهٔ آفلاین با Try again می‌دهد. پیام، API، SSE، login response، مدل، texture و هیچ اطلاعات خصوصی در Cache Storage ذخیره نمی‌شوند. حالت آفلاین Composer را از ارسال بازمی‌دارد و draft را برای تایپ نگه می‌دارد؛ پیام تازه به صف ارسال خودکار وارد نمی‌شود.
- فایل‌های manifest، worker و icons عمومی‌اند تا هنگام فعال‌بودن password gate، نصب خراب نشود؛ صفحات دفتر و APIها همچنان به احراز هویت نیاز دارند.

## حدود آمادگی

این تغییر، پایهٔ PWA قابل نصب در مرورگر پشتیبان است؛ انتشار App Store/Play Store، push notification، همگام‌سازی سروری ظاهر و کار کامل آفلاین پیام‌ها در آن نیست. نصب واقعی به HTTPS و مرورگر/سیستم‌عامل وابسته است. روی iOS از Share → Add to Home Screen استفاده می‌شود؛ نبودن prompt خودکار، خطای برنامه نیست.

«تمام کار لازم انجام شده» تنها برای محدودهٔ آزموده‌شدهٔ همین increment قابل استفاده است. فازهای چهره/لباس/ویرایشگر/LOD، پذیرش عملکرد روی Android و iOS واقعی و تعامل espresso/meeting هنوز با معیارهای جدا باقی‌اند؛ [پوشش کامل](AVATAR_UPGRADE_COVERAGE.fa.md) و [تعامل‌ها](CHARACTER_INTERACTIONS.fa.md) مرجع وضعیت‌اند.

## بازتولید و اعتبارسنجی

```sh
node scripts/build_app_icons.mjs
node integrations/run_topic_tests.cjs ../lib/color-mode.test.ts
node integrations/run_topic_tests.cjs ../lib/webapp.test.ts
node integrations/run_topic_tests.cjs ../lib/avatar/motion.test.ts
node integrations/run_topic_tests.cjs ../lib/avatar/status.test.ts
```

آزمون browser باید انتخاب Dark از UI، reload، System و تغییر تنظیم سیستم، override، رنگ واقعی پنل و صحنه، keyboard/focus، viewport موبایل، نصب‌پذیری manifest/worker و offline بدون ارسال را بررسی کند. هیچ پیام واقعی برای این QA ارسال نمی‌شود. آزمون نصب iOS/Android واقعی و عملکرد GPU آن‌ها همچنان gate دستگاه واقعی است.

## نتیجهٔ اعتبارسنجی این مرحله

کد checkpoint `3a588aa` با lint، build و typecheck و ده مجموعهٔ تست فرانت‌اند عبور کرد. آزمون production browser در Chromium 154 با SwiftShader در 1600×1000 و 390×844، Light/Dark/System، تغییر OS و override، Reduced motion، کیبورد/focus، manifest/PNGها، worker فعال و Cache Storage خالی، قطع اتصال بدون ارسال و حفظ تنظیم در بازگشت مستقیم به Lounge را گذراند. page error و console error در فاز آنلاین صفر بودند. کنتراست roleهای متن اصلی/ثانویه با surface/inset/canvas حداقل 4.8 در روشن و 6.67 در تیره بود؛ این عدد، گواهی ممیزی کامل WCAG تمام وضعیت‌ها نیست.

در سرور آزمایشی با password فعال، manifest/worker/icons پاسخ 200، صفحهٔ دفتر redirect به login و API خصوصی پاسخ 401 داشتند. پیام واقعی، عملیات Telegram یا فراخوانی مدل در آزمون انجام نشد. نتیجهٔ نرم‌افزاری مرورگر به عنوان FPS گوشی گزارش نمی‌شود.

بازبینی مستقل سه مورد یافت که اصلاح شدند: refresh محدود برای SSE بدون تغییر محتوا، جلوگیری از تایپ بر اساس timestamp حدسی worker، و اعمال Reduced motion در Lounge/Schedule بدون نیاز به mount صحنه. تست‌های status و refresh قبل از اصلاح شکست خوردند و پس از اصلاح عبور کردند؛ سناریوی مرورگرِ Lounge پس از اصلاح نیز عبور کرد.

[گزارش ماشینی](benchmarks/dark-webapp-validation.json) · [نمای دارک دسکتاپ](screenshots/studio-dark-desktop.png) · [نمای دارک موبایل](screenshots/studio-dark-mobile.png). تصاویر از fixture محلی شش‌نفره‌اند و اطلاعات دفتر زنده را نشان نمی‌دهند.
