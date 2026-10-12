# پیام آماده برای بات تلگرام hermes

فایل `hermes-office.zip` را در چت بات بفرستید و همراهش (یا بلافاصله بعدش) این پیام را ارسال کنید:

---

سلام. فایل zip پیوست، پروژهٔ «Hermes Office» است (دفتر مجازی سه‌بعدی برای تیم‌های agent که به API خودِ تو وصل می‌شود). می‌خواهم آن را روی همین سرور برای پروداکشن بالا بیاوری و روی دامنهٔ من با HTTPS زنده کنی.

دستورالعمل کامل و قدم‌به‌قدم داخل فایل `docs/HANDOFF.md` در همین zip است. لطفاً:

1. zip را در مسیر `/opt/hermes-office` باز کن و `docs/HANDOFF.md` را کامل بخوان.
2. دقیقاً طبق همان مراحل جلو برو و بعد از هر مرحله بررسی‌اش را اجرا کن.
3. قبل از شروع، اطلاعات بخش ۱ را از من بپرس (دامنه، ایمیل، رمز ورود) و IP عمومی سرور را بگو تا رکورد DNS را بسازم.
4. قبل از ری‌استارت gateway خودت (مرحلهٔ ۵) به من خبر بده و بگو بعدش چه پیامی برایت بفرستم تا ادامه بدهی.
5. در پایان خروجی `deploy/verify.sh` را برایم بفرست و آدرس و رمز ورود را بده.

Backend مربوط به Claude Code را فعال نکن مگر خودم بخواهم.

---

> اگر بات نتوانست فایل پیوست را روی دیسک پیدا کند، کد روی GitHub در شاخهٔ `Office` مخزن `HoMoHUA/nextjs-boilerplate` هم هست (بخش ۳ سند HANDOFF).

## English version (if your bot works better in English)

Attached is **Hermes Office**, a 3D virtual office web app that connects to your own API server. Deploy it on this server for production and put it live with HTTPS on my domain. The complete runbook is `docs/HANDOFF.md` inside the zip: unzip to `/opt/hermes-office`, read the whole runbook, follow it step by step running each check, ask me for the inputs in section 1 first (domain, email, password) and tell me the server's public IP for the DNS record. Warn me before you restart your own gateway in step 5 and tell me what to send to resume. Finish by sending me the `deploy/verify.sh` output, the URL and the password. Do not enable the Claude Code backend unless I ask.
