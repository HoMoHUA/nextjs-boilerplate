# baseline اولیهٔ ارتقای آواتار

تاریخ: 2026-10-19 UTC. مرجع قبل از این فاز: `5d611ee` روی `codex/office-studio-upgrade`.

این مرحله، census فایل و شواهد رگرسیون است؛ benchmark کامل دستگاه واقعی نیست. گزارش ماشینی قابل تکرار: [avatar-assets.json](avatar-assets.json).

```sh
node integrations/avatar_asset_census.mjs
```

هفت GLB محلی با GLTFLoader بارگذاری شدند؛ position/normal/UV متناهی و indexها معتبرند. SHA-256 و حجم هر asset در JSON ثبت شده‌اند. شمارش هندسهٔ کاراکتر با multiplicity قطعات رندر فعلی، شش مدل مو، هر دو حالت عینک و قواعد فعلی آستین/هدفون انجام شده است.

| تعداد کاراکتر | مثلث قابل نمایش، بدون محیط و پاس‌های اضافه |
|---|---:|
| 1 | 19,254–21,248 |
| 6 | 115,524–127,488 |
| 12 | 231,048–254,976 |

این اعداد از هدف موقت 12,000 برای High بیشترند. برای کاهش هزینه، P6 باید LOD کاراکتر، تعداد material/mesh، پاس shadow/effect و محیط را با هم بررسی کند. triangle count به‌تنهایی نتیجهٔ FPS نیست.

شواهد تصویر و تعامل baseline قبلی در `docs/screenshots/studio-desktop.png`، `studio-mobile.png`، `studio-comparison.jpg` و `studio-verification.json` موجودند. محدودیت fidelity در `design-qa.md` همچنان باز است. ساخت P1 ظاهر legacy موجود را عوض نمی‌کند؛ هنوز editor یا تنوع بصری تازه‌ای برای screenshot ندارد.

## ماتریس اندازه‌گیری باقی‌مانده

- **P0/P6 باز:** انتخاب دستگاه مرجع؛ Chromium دسکتاپ، Android Chrome و iOS Safari واقعی، با مشخصات دستگاه/نسخه/viewport/DPR/quality.
- **P6 باز:** حداقل 60 ثانیه پس از warm-up برای 1/6/12، idle/processing و Thread؛ Preview پس از ساخت P4 اضافه می‌شود. median/p95، main/shadow/effect calls، triangles، JS/GPU memory در حد ابزار و cold/warm loading ثبت شوند.
- **P6 باز:** churn صفحات، editor و quality، resourceهای برگشت‌پذیر، hidden/resume، context-loss و storage failure؛ مقایسه با نسخهٔ پیش از ارتقا و اهداف مصوب.
- **قابل ادعا نیست:** FPS گوشی، سقف 250 draw calls، عدم leak نهایی، عملکرد Auto یا عبور از بودجهٔ Low/Medium/High؛ ابزار/قابلیت لازم برای این gateها هنوز کامل نشده است.

## اعتبارسنجی فاز داده

دو suite آواتار، دو suite موجود تاپیک، English UI، lint، production build و typecheck اجرا شدند. آزمون store از مسیر واقعی hydrate/snapshot/persist عبور می‌کند، از شبکه استفاده نمی‌کند و مرز localStorage را با fixture کنترل می‌کند. سناریوها شامل شش ظاهر legacy، گروه‌های متفاوت، Save/Reset مستقل، default پایدار، JSON بسته و محدود، نسخهٔ آینده، overflow مهاجرت، مقصد native، نام واقعی، history/tombstone و none بعد از reload هستند.

بازبینی مستقل دو مشکل migration بیش از سقف و اعتبارسنجی تکراری برای هر actor را یافت؛ آزمون‌های مربوط ابتدا شکست خوردند و پس از اصلاح عبور کردند. سقف JSON با آزمون round-trip یک مجموعهٔ کامل 512 رکورد از 256 KiB به 1 MiB اصلاح شد. هیچ دادهٔ نامرتبط Telegram از طریق spread به رکورد ظاهر وارد نمی‌شود.

بررسی Python محلی `test_bridge test_topic_bridge test_live_bridge test_runtime_agents`: **24 از 25 عبور**. تست موجود `test_sse_exercises_real_child_without_real_claude_prompt` به علت دسترسی ممنوع به `/root/.claude/agents` خطا می‌دهد و سپس انتظار `permissionMode` در پاسخ موفق برقرار نیست. این مسیر backend در این تغییر دست نخورده است؛ نتیجهٔ این suite سبز گزارش نمی‌شود. `test_claude_routing.py` وابسته به فایل deployment در `/root/claude_bot/bot.py` است و در این cloud اجرا نشده است. هیچ پیام واقعی به Telegram یا مدل ارسال نشده است.

مرورگر production build همین فاز نیز با fixture شش‌نفرهٔ محلی در 1600×1000 و 390×844 بررسی شد: بارگذاری مدل/بافت، انتخاب، مدیریت تیم، drawer/composer موبایل و حفظ انتخاب پس از reload عبور کردند؛ page/console/asset error صفر. گزارش قابل خواندن توسط ماشین: [avatar-foundation-browser.json](avatar-foundation-browser.json). این سناریو رگرسیون صحنهٔ محلی است؛ قرارداد دادهٔ ظاهر تاپیک در دو suite آواتار آزموده شده است.
