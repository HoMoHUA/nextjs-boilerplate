# تطبیق سند ارتقای آواتار با اجرای دفتر

تاریخ: 2026-10-19 UTC؛ baseline اجرا: `5d611ee`؛ شاخه: `codex/office-studio-upgrade`.

فایل پیوست `AVATAR_UPGRADE_PLAN.fa (1).md` بایت‌به‌بایت با [سند موجود](AVATAR_UPGRADE_PLAN.fa.md) یکسان است. متن اصلی برای حفظ مرجع تغییر نمی‌کند. این گزارش وضعیت اجرای فعلی و تفاوت تصمیم‌ها را ثبت می‌کند. «در برنامه» به معنی پیاده‌سازی یا پذیرش نیست.

## تصمیم‌های اجرا

- کاربر قبلاً تصویر `docs/concepts/office-studio-concept.png` را دیده و اجرای آن را تأیید کرده است. بنابراین مسیر فعلی مدل‌های تألیفی Blender/GLB است؛ پیشنهاد Procedural سند الزام به بازنویسی این کار نیست. سبک تأیید شده است، اما تطابق نهایی چهره و لباس هنوز پذیرفته نشده؛ `design-qa.md` این فاصله را ثبت کرده است.
- تمام کار روی شاخهٔ مستقل فعلی می‌ماند؛ `Office` و کار هم‌زمان Hermes ادغام یا بازنویسی نمی‌شوند. انتشار روی دفتر زنده بخشی از این مرحله نیست.
- درخواست فعلی، بررسی همهٔ بندها و شروع فازهای ابتدایی است. P0 و زیرساخت P1 در این نوبت اجرا می‌شوند؛ P2 تا P7 خروجی‌های بعدی‌اند، نه قابلیت‌های وعده‌داده‌شدهٔ موجود.
- schema نام‌های کاتالوگ آینده را نگه می‌دارد؛ داشتن مقدار در schema به معنی مدل قابل انتخاب نیست. فقط شش مدل موی فعلی و فیلدهای `AgentLook` توسط adapter اولیه نمایش داده می‌شوند. مدل‌های تازه پس از QA بصری فعال می‌شوند.
- Import/export رابط کاربر به P4 منتقل می‌شود. اعتبارسنجی JSON و حفظ نسخهٔ ناشناخته از P1 لازم است. همگام‌سازی بین دستگاه‌ها، مدل از URL/عکس کاربر و تغییر backend خارج از دامنه‌اند.
- بودجه‌های سند موقت‌اند. رندر نرم‌افزاری این محیط اثبات FPS گوشی نیست. آزمون Android/iOS واقعی و انتخاب سخت‌افزار مرجع در gate عملکرد باز می‌مانند؛ عدد تخمینی به‌جای نتیجهٔ واقعی گزارش نمی‌شود.

## پوشش الزامات قابلیت‌ها

| الزام | وضعیت در baseline | خروجی باقی‌مانده و فاز |
|---|---|---|
| FR-01 صورت | سر یکپارچه، بینی، فک، پلک و ابرو در GLB؛ تنوع ابعاد محدود | صورت round/oval/angular و انتخاب مستقل اجزا، anchors و خوانایی در اندازهٔ واقعی: P2؛ وضوح selected/processing: P5 |
| FR-02 مو و پوشش صورت | شش موی تألیفی، یک عینک؛ هدفون وابسته به buzz | wavy/side-part/ponytail، ریش، فرم‌های عینک و ترکیب‌های مجاز با توضیح انگلیسی: P2/P3 |
| FR-03 لباس/بدن | پوشش دارای یقه/درز/بافت، دست و کفش تألیفی؛ تماس نشستن اصلاح شده | چهار outfit، آستین مستقل از مو، بدن compact/average/tall، کفش و socket مستقل و آزمون مرزی تماس: P3 |
| FR-04 هویت/ذخیره | `lookFor(topicId)` و storage عمومی؛ ویرایش مستقل ظاهر ندارد | schema و کلید group/topic، حفظ legacy و adapter: P1؛ Save/Cancel/Reset، هشدار storage و reload در editor: P4 |
| FR-05 وضعیت معتبر | انیمیشن idle/working و projection وضعیت موجود | queued/posting/offline/stale به waiting/unknown، جلوگیری از success استنباطی، seed زمانی پایدار، damping و transitions: P5 |
| FR-06 کیفیت/دسترس‌پذیری | DPR محدود موبایل، سایهٔ سبک‌تر، fallback بارگذاری/خطای Canvas و Retry | چهار Quality، Auto محافظه‌کار با hysteresis، Reduced motion مستقل، hidden-tab/resume و context-loss واقعی: P5/P6 |

## تمام تسک‌های سند

| شناسه | وضعیت واقعی پیش از این نوبت | برنامه و معیار خروج |
|---|---|---|
| AVA-001 | بخشی: screenshot و QA fixture موجود؛ benchmark سخت‌افزار ندارد | P0: مرجع نسخه/asset census و صحنهٔ 1/6/12؛ P6: ماتریس 60 ثانیه‌ای دستگاه واقعی |
| AVA-002 | سبک کلی با کاربر تأیید؛ fidelity هنوز blocked | P0/P2: نمونهٔ صورت/لباس در اندازهٔ دسکتاپ و موبایل و تأیید نهایی |
| AVA-003 | انجام نشده | P1: types/catalog/validator سخت‌گیر؛ خطای رنگ، حد اندازه/تعداد، نسخهٔ ناشناخته |
| AVA-004 | انجام نشده | P1: مهاجرت بدون تغییر ظاهر legacy، idempotence، projection V1 و حفظ دادهٔ V2 |
| AVA-005 | بخشی: mesh صورت مشترک و تنوع کوچک | P2: پارامترهای چهره و snapshot با زمان و seed ثابت |
| AVA-006 | بخشی: شش مو و یک عینک، geometry مشترک | P2: فرم‌های تازه/ریش/عینک، compatibility و تست مالکیت resource |
| AVA-007 | بخشی: لباس تألیفی؛ آستین هنوز تابع مو | P3: outfit/body مستقل و تست تماس میز/صندلی |
| AVA-008 | بخشی: هدفون ثابت و اشیای میز | P3: head/wrist/desk sockets، انتخاب مستقل و ترکیب‌های مجاز |
| AVA-009 | انجام نشده | P4: Appearance modal و Preview مستقل؛ draft وارد Scene نشود |
| AVA-010 | انجام نشده | P4: Save/Cancel/Reset، storage full/denied، focus/keyboard/mobile/reload |
| AVA-011 | انجام نشده | P5: status adapter محافظه‌کار با آزمون queued/offline/worker-ended |
| AVA-012 | بخشی: idle و حرکت joint موجود | P5: delta مستقل از FPS، Reduced motion، resume بدون پخش اثر قدیمی |
| AVA-013 | بخشی: geometry مشترک، کف instanced، joinery merged؛ LOD ندارد | P6: LOD، material pooling با ownership و benchmark مقایسه‌ای |
| AVA-014 | بخشی: loading/error fallback و Retry تست شده | P6: Quality/Auto/override، hidden/context-loss و چرخهٔ leak |
| AVA-015 | بخشی: نور/بافت و سایهٔ تماس پویا، GTAO دسکتاپ | P6: اندازه‌گیری پاس‌ها، cache label با ResizeObserver، read-then-write DOM |
| AVA-016 | بخشی: build/lint/type/رگرسیون و QA snapshot موجود | P7: flag renderer، staging، rollback drill، regression کامل و بستهٔ شواهد |
| AVA-017 | نمونهٔ GLB و generator وجود دارد؛ مقایسهٔ کنترل‌شده با Procedural V2 ندارد | P0: ثبت تصمیم مسیر تأییدشده؛ P6: مقایسهٔ هزینهٔ واقعی؛ rig/socket/clip طبق نیاز P3/P5 |

## پوشش بندهای فرابخشی سند

| بندهای سند | تعهد و محل اثبات |
|---|---|
| 1–4: دامنه، برند و قراردادهای ثابت | نام واقعی، scene-only `topicRoomId`، 12 صندلی، all/none، اتاق محلی، English/LTR و raw `dir=auto` حفظ می‌شوند؛ رگرسیون موجود در هر فاز اجرا و در P7 گسترده می‌شود. هیچ هویت ظاهری از نام/جنسیت/قومیت حدس زده نمی‌شود. |
| 6–7: معماری و داده | `lib/avatar/` فقط JSON؛ renderer صاحب ref/Object3D؛ group/topic ثابت، defaults بدون mutation، legacy clone، unknown-version بدون حذف و rollback فقط نمایشی: P1. مجوز دسترسی از record ظاهری ساخته نمی‌شود. |
| 8: رابط Appearance | ورود از موضوع فعال و منوی موضوع، بخش‌های Face/Hair/Outfit/Accessories/Quality، Preview/Save/Cancel/Reset/Use default و import/export فقط JSON: P4. تست focus trap/Escape/بازگشت focus، اسکرول و footer در viewport و متن نام واقعی الزامی است. |
| 9: مدل، مواد و تماس | مواد مات فعلی و geometry مشترک حفظ؛ جزئیات فقط با فایدهٔ قابل مشاهده. مالکیت material/texture و همسانی رنگ در LOD: P3/P6. قد 0.92–1.08 فقط پس از تست نمونه، labels/bounds مشتق از بدن: P3. |
| 10: حرکت | وضعیت اجرا مستقل از ظاهر؛ idle seeded، عدم Random هر frame، damp در 30/60/120، selected بدون success، نگاه محدود و عدم handoff ساختگی: P5. |
| 11: نور و label | نور فعلی نمونهٔ اولیه است؛ blur/DOF/bloom پیش‌فرض نداریم. shadow budget، bounds نام در زوم/موبایل و DOM batching: P6. |
| 12: عملکرد | 3k/7k/12k triangle و 250 calls هدف موقت؛ scene فعلی باید اندازه‌گیری و در P6 اصلاح شود. ثبت 1/6/12، idle/processing/thread/preview، 60s، median/p95، calls main/shadow/effects، memory/loading، cold/warm و churn الزامی؛ editor فعلاً وجود ندارد و نتیجه‌ای برای آن ساخته نمی‌شود. |
| 13: امنیت و a11y | schema بسته و محدود: P1؛ import محصور، assets allowlist، بدون prompt/token/messages و شبکه: P4؛ status غیر صرفاً رنگ، keyboard/touch و fallback واقعی context loss: P5/P6. |
| 14: GLB | asset محلی تألیفی و scripts/provenance موجود؛ skeleton clips فایلی نداریم، jointها اکنون با کد حرکت می‌کنند. تبدیل به rig/clip و compression تنها با سود اندازه‌گیری‌شده و Safari QA: P3/P5/P6. |
| 15–17: اجرا و تست | فازها در جدول بعد؛ هر فاز شواهد مستقل، unit/integration/visual/failure متناسب دارد. `qa_topics.py` پیام واقعی می‌فرستد و در این نوبت اجرا نمی‌شود. |
| 18: انتشار | فقط branch مستقل؛ feature flag، build قبلی و rollback بدون حذف appearance/messages/visibility: P7. هیچ restart Gateway/bot، تغییر credentials یا انتشار زنده در این مرحله وجود ندارد. |
| 19–20: ریسک و Done | performance، clipping، تکرار چهره، fake activity، storage، license و دو renderer ریسک بازند. Done فقط با عبور از gateها؛ بستهٔ نهایی شامل کد/tests/benchmark/screenshots/manifest/migration/rollback/help خواهد بود. |

## ترتیب اجرا و gateها

1. **P0 — ممیزی و baseline:** این گزارش، نسخه و شواهد قبلی، census قابل تکرار assets و ثبت فاصلهٔ fidelity/عملکرد. تا انتخاب و تست دستگاه مرجع، gate عملکرد باز می‌ماند.
2. **P1 — زیرساخت هویت ظاهر:** schema/catalog/validation، group/topic، migration و adapter به renderer فعلی، آزمون snapshot/reload و حفاظت تاریخچه/visibility/send-target. هدف اجرای کد در این نوبت است؛ editor و نمایش تمام فیلدها جزو این gate نیستند.
3. **P2 — چهره/مو:** پس از P1، مدل‌های قابل تشخیص و ترکیب‌های مجاز در اندازهٔ واقعی؛ snapshot ثابت و resource budget.
4. **P3 — بدن/لباس/اشیا:** پس از نمونهٔ P2، لباس و socket مستقل، رفع وابستگی مو/آستین و تماس بدن در حالت‌های مرزی.
5. **P4 — Appearance editor:** پس از موجود شدن مدل‌های قابل انتخاب P2/P3؛ persistence و خطاهای storage، draft، preview، keyboard/mobile و import/export محدود.
6. **P5 — وضعیت و حرکت:** پس از قرارداد joint P3؛ adapter وضعیت واقعی و حرکت پایدار با Reduced motion و lifecycle.
7. **P6 — کیفیت و هزینه:** با نمونهٔ P2–P5؛ LOD/Auto/DOM/shadow/resource و تست دستگاه واقعی. ثبت عدم عبور از بودجه، معادل قبول نیست.
8. **P7 — پذیرش و تحویل:** regression، fidelity، staging/flag/rollback و گزارش نهایی. انتشار زنده مرحلهٔ جداگانه است.

برآورد 104–168 ساعت سند مربوط به مسیر Procedural اولیه است؛ برای مسیر GLB فعلی تعهد زمانی محسوب نمی‌شود. برنامهٔ اجرایی P0/P1 در [پلن آغاز اجرا](superpowers/plans/2026-10-19-avatar-foundation.md) ثبت می‌شود.

## خروجی اجرای ابتدایی این نوبت

به‌روزرسانی درخواست 2026-10-20 تهران: [دارک‌مود و پایهٔ وب‌اپ](DARK_MODE_WEBAPP.fa.md) و [ممیزی و مراحل تعامل طبیعی](CHARACTER_INTERACTIONS.fa.md) به دامنه اضافه شدند. بخشی از P5 (حرکت هویت‌محور، مکث تایپ، damping، Reduced motion، hidden-tab و نگاشت وضعیت معتبر) در ادامه پیاده شد؛ فهرست زیر checkpoint قبلی را توضیح می‌دهد و به معنی تمام‌شدن gate P5 نیست.

- **P0 اجرا شد، gate کامل باز است:** تطبیق تمام بندها، تصمیم مسیر GLB و [census واقعی هفت asset](benchmarks/AVATAR_BASELINE.fa.md) ثبت شد. هندسهٔ یک کاراکتر 19,254–21,248 مثلث است؛ هدف موقت High رعایت نشده و تست دستگاه واقعی باقی است.
- **زیرساخت P1 پیاده شد:** `lib/avatar/` شامل schema/catalog، validator بسته، کلید دقیق group/topic، default پایدار، clone ظاهر legacy، helperهای Save/Reset و adapter به فیلدهای renderer فعلی است. hydrate و snapshot و projection به آن وصل شده‌اند؛ ظاهر قدیمی هنگام مهاجرت حفظ می‌شود.
- **حفاظت داده:** رکوردها حداکثر 512، seed حداکثر 128 کاراکتر و JSON حداکثر 1 MiB است. نسخهٔ ناشناخته/خراب بدون حذف نگهداری و با ظاهر legacy نمایش داده می‌شود. مهاجرت بیش از سقف، اتمیک به legacy برمی‌گردد؛ ویرایش تنظیمات مقداردهی‌نشده/ناشناخته مجاز نیست. هشدار قابل مشاهده و export بازیابی در P4 اضافه می‌شوند.
- **آزمون‌ها:** دو suite آواتار، دو suite موجود تاپیک، English UI، lint/typecheck/build و اعتبارسنجی GLB عبور کردند؛ [گزارش baseline](benchmarks/AVATAR_BASELINE.fa.md) محدودیت و خطای مستقل تست backend را هم ثبت کرده است.
- **هنوز ساخته نشده:** editor، نمایش همهٔ فیلدهای جدید صورت/لباس، LOD و Quality، Reduced motion، status adapter جدید و feature flag/rollback renderer کامل. گزینهٔ `renderer: v1` در این مرحله فقط adapter داده به ظاهر legacy است؛ مدل قدیمی procedural را بارگذاری نمی‌کند. فازهای P2 تا P7 برای این موارد باقی‌اند.
