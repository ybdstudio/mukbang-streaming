# Mukbang Bang V3 — gameplay design (ăn là trọng tâm)

Ngày 03/11/2026 · thay thế vòng chơi V2 (`docs/GAME-DESIGN-V2.md` giữ làm lịch sử). Art: `docs/ART-DIRECTION-V3.md`.
Trạng thái: **vòng ăn V3 chơi được** (50 stream), hoạt động tuỳ chọn, Wardrobe, quảng cáo đo thật; art vẫn là bộ V1 + hình canvas tạm chờ thiết kế mới.

---

## 1. Audit → thay đổi

| V2 | V3 |
|---|---|
| Mỗi level bắt buộc đi siêu thị / đặt hàng / buffet / nấu trước khi stream | **START MUKBANG** vào thẳng stream; 4 nguồn đồ ăn thành **hoạt động tuỳ chọn** ở Home |
| Nhiều món trên bàn, combo / cay / fan request / vòng encore | **Một món duy nhất**: mở gói → **3 lần gắp × 3 miếng** → viral |
| Thời lượng kéo bằng vòng encore | Thời lượng bằng **50 món khác nhau**, sự kiện fan, hoạt động, Wardrobe |
| Không có thời trang | **Wardrobe**: 6 outfit, 8 phụ kiện tóc, 6 phụ kiện, 3 themed look |
| 3 ad place | 6 ad place (thêm surprise food, fashion reward, viral boost), **đếm impression thật**, cooldown 30 s |

Giữ nguyên: HS kit 3.2.4 / SDK 1.1.3, key literal trong `game.js`, `showAd` chỉ trong tap, profile cloud, web shim, fallback canvas, bộ art V1 (đến khi có art V3).
Code: `src/stream.js` (vòng ăn), `src/levels.js` (50 stream), `src/wardrobe.js` + `src/wardrobe-scene.js`, `src/scenes.js` + phần market trong `game.js` (hoạt động), `src/catalog.js` (món). `src/mech.js` (V2) đã bỏ.

## 2. State machine
```
(new player) ──────────────▶ stream
home ──START MUKBANG──▶ stream ──▶ result ──NEXT──▶ stream (level+1)      [interstitial ở NEXT/REPLAY/HOME/AGAIN, từ stream 4, cooldown 30 s]
  ├─ SHOP / ORDER / BUFFET / COOK ─▶ (chọn 1 món) ─▶ stream (bonus, không tăng level) ─▶ result ─▶ AGAIN / MAIN STREAM / HOME
  ├─ WARDROBE · LEVELS · STARS · SETTINGS · (HS) SHOP
  └─ ▶ SURPRISE (rewarded) ─▶ stream món hiếm
stream phases: sealed ─tap─▶ opening ─▶ open ─tap|drag─▶ carry ─▶ chew(3 bites) ─▶ react ─┐ ×3 ─▶ empty ─▶ finale ─▶ result
                                          ▲──────────────────────────────────────────────┘
```

## 3. Vòng ăn (một stream)

| Bước | Thời gian | Người chơi | Phản hồi |
|---|---|---|---|
| Sealed | — | **chạm** gói (gói phát sáng nhẹ, chữ "TAP · TEAR IT OPEN!") | (viral boost ad tuỳ chọn chỉ ở bước này) |
| Opening | 0,75 s | — | animation theo loại bao bì (§3.2), âm thanh mở, mặt "open" |
| Open & full | — | **chạm** gói (portion tự bay tới miệng) **hoặc kéo** portion tới miệng (vào vùng miệng là ăn ngay) | vòng miệng nét đứt khi kéo; thả trượt → portion bay về, không mất lượt |
| Chew | 2,25 s | — (thư giãn, không canh nhịp) | **3 miếng** cách 0,85 s: mặt theo vị / nhai, âm ASMR theo món (to dần qua các lượt), vụn bay, +viewers, +coin, chat |
| React | 1,5 s | tuỳ chọn: chạm tim bay | banner theo nhịp cảm xúc (§3.1) |
| ×3 | | | gói chuyển trạng thái: full → sau lượt 1 → sau lượt 2 → **rỗng** |
| Empty | 1,0 s | — | "ALL GONE!" |
| Finale | 2,8 s | — | **VIRAL!** + số viewers + coin thưởng, confetti, mưa tim, mặt "yum" |
| Result | | NEXT | sao, viewers, coin, mở khoá, ad bonus tuỳ chọn |

Thời lượng một stream ≈ 18–25 s chơi + kết quả.

### 3.1 Ba nhịp cảm xúc
1. **Lượt 1 — FIRST TASTE!**: biểu cảm theo vị (ngọt: mắt tim; cay: lè lưỡi lửa; lạnh: run; chua: nhăn; fizzy: tròn mắt), dòng phụ theo âm (SO CRUNCHY! / SLURRRP! / SO CREAMY!…).
2. **Lượt 2 — FANS GOING WILD!**: âm to hơn, gấp đôi reaction, **sự kiện fan** của stream xảy ra (§3.3).
3. **Lượt 3 — LAST BITE!** → gói rỗng → **VIRAL!**: tăng vọt viewers (+8 % goal), thưởng coin = 3 miếng, chat bùng nổ.

### 3.2 Năm kiểu bao bì (giới thiệu trong 10 stream đầu)
| Kiểu | Món | Mở | Xuất hiện đầu |
|---|---|---|---|
| bag | snack túi | xé dải trên cùng | 1 |
| cup | mì ly, kem ly | bóc nắp | 3 |
| bottle | đồ uống | bật nắp + bọt | 4 |
| dome | bánh, trái cây, món đĩa | nhấc nắp chuông | 5 |
| box | món giao hàng | mở nắp hộp | 10 |

### 3.3 Sự kiện fan (không có áp lực thời gian)
hearts (mưa tim để chạm) · gift (hộp quà rơi, chạm lấy coin) · superchat (banner tự động + coin) · wave (chat bùng nổ + viewers) · spotlight ("TRENDING #1", camera zoom) · duet (fan tham gia, mưa tim).
**Tim bay luôn có** trong lúc nhai: chạm = +2,5 % goal viewers. Sao: 1★ xong · 2★ đạt goal (ăn bình thường là đạt) · 3★ ≥ 1,3× goal (chạm tim / quà).

## 4. 50 stream — tiến trình

Goal 500 → ~2M viewers (đường log). Mỗi stream một món, không lặp. Mới mỗi chương: món, kiểu bao bì, âm ASMR, biểu cảm, sự kiện fan, look/streamer/hoạt động.

| # | Chương | Tên | Món | Bao bì | Sự kiện fan | Goal | Mở khoá / mới |
|---|---|---|---|---|---|---|---|
| 1 | 1 | First Crunch | Cat Chips | bag | hearts | 500 |  |
| 2 | 1 | Honey Puff Pop | Honey Puffs | bag | hearts | 590 | NEW REACTION: SWEET FACE |
| 3 | 1 | Slurp Time | Cheese Noodle | cup | gift | 700 | Hoạt động: market; NEW PACKAGE: PEEL THE LID; NEW ASMR SOUND |
| 4 | 1 | Fizzy Fun | Soda Pop | bottle | gift | 830 | NEW PACKAGE: POP IT OPEN; NEW REACTION: FIZZY FACE; NEW ASMR SOUND |
| 5 | 1 | Cake Day | Strawberry Cake | dome | superchat | 980 | NEW PACKAGE: LIFT THE LID; NEW ASMR SOUND |
| 6 | 1 | Rainbow Crunch | Rainbow Candy | bag | gift | 1,200 | Wardrobe; Look: hair_bow |
| 7 | 1 | Peachy Sip | Peach Milk | bottle | wave | 1,400 | Hoạt động: delivery |
| 8 | 1 | Too Spicy! | Chili Noodle | cup | superchat | 1,600 | NEW REACTION: SPICY FACE |
| 9 | 2 | Brain Freeze | Mint Choc | cup | wave | 1,900 | NEW REACTION: COLD FACE; NEW ASMR SOUND |
| 10 | 2 | Crispy Chicken Party | Korean Fried Chicken | box | gift | 2,300 | Streamer: kiko; NEW PACKAGE: OPEN THE BOX |
| 11 | 2 | Matcha Moment | Matcha Roll | dome | spotlight | 2,700 | Hoạt động: buffet |
| 12 | 2 | Sour Squad | Gummy Bears | bag | superchat | 3,200 | NEW REACTION: SOUR FACE |
| 13 | 2 | Boba Break | Bubble Tea | bottle | wave | 3,800 | Look: acc_glasses_round |
| 14 | 2 | Ocean Crunch | Seaweed Crisps | bag | gift | 4,500 |  |
| 15 | 2 | Banana Milk Bliss | Banana Milk | bottle | spotlight | 5,300 | Hoạt động: kitchen |
| 16 | 2 | Pizza Night | Pepperoni Pizza | box | duet | 6,300 | Look: outfit_sunny; NEW ASMR SOUND |
| 17 | 3 | Melon Jelly | Melon Jelly Bowl | dome | wave | 7,500 |  |
| 18 | 3 | Pretzel Twist | Choco Pretzels | bag | gift | 8,900 |  |
| 19 | 3 | Fire Rice Cakes | Tteokbokki | box | superchat | 11,000 | Look: hair_cat_ears |
| 20 | 3 | Blue Moon Scoop | Blue Moon | cup | spotlight | 12,000 | Streamer: momo |
| 21 | 3 | Mango Cheesecake | Mango Cheesecake | dome | duet | 15,000 |  |
| 22 | 3 | Berry Blast | Berry Smoothie | bottle | wave | 17,000 | Look: acc_headphones |
| 23 | 3 | Sushi Platter | Sushi Set | box | gift | 21,000 |  |
| 24 | 3 | Sakura Slurp | Sakura Noodle | cup | spotlight | 25,000 | Look: outfit_sakura |
| 25 | 4 | Seafood Cup | Seafood Noodle | cup | wave | 29,000 |  |
| 26 | 4 | Midnight Mousse | Choco Mousse | dome | duet | 34,000 |  |
| 27 | 4 | Burger Bite | Cheese Burger | box | gift | 41,000 | Look: outfit_chef |
| 28 | 4 | Strawberry Swirl | Strawberry Swirl | cup | superchat | 48,000 |  |
| 29 | 4 | Dumpling Feast | Dumplings | box | wave | 57,000 | Look: hair_flowers |
| 30 | 4 | Rainbow Crepe | Rainbow Crepe | dome | spotlight | 68,000 |  |
| 31 | 4 | Hotpot for One | Mini Hotpot | box | duet | 80,000 | Look: acc_heart_glasses |
| 32 | 4 | Cookies & Cream | Cookie Cream | cup | gift | 95,000 |  |
| 33 | 5 | Black Bean Slurp | Black Bean Noodle | cup | wave | 110,000 |  |
| 34 | 5 | Grape Pop | Grape Bunch | dome | spotlight | 130,000 | Look: hair_bunny_ears |
| 35 | 5 | Curry Comfort | Curry Rice | box | duet | 160,000 |  |
| 36 | 5 | Mango Sorbet | Mango Sorbet | cup | superchat | 190,000 | Look: outfit_star |
| 37 | 5 | Seafood Boil Mania | Seafood Boil | box | duet | 220,000 |  |
| 38 | 5 | Berry Tart | Berry Tart | dome | gift | 260,000 | Look: acc_scarf |
| 39 | 5 | Sundae Supreme | Choco Sundae | cup | spotlight | 310,000 |  |
| 40 | 5 | Superstar Finale | Golden Parfait | dome | duet | 370,000 | Look: hair_crown |
| 41 | 6 | Forest Noodles | Mushroom Noodle | cup | wave | 440,000 |  |
| 42 | 6 | Matcha Latte Art | Matcha Latte | bottle | spotlight | 520,000 |  |
| 43 | 6 | Wing Challenge | Spicy Wings | dome | superchat | 610,000 |  |
| 44 | 6 | Mango Party | Mango Cubes | dome | gift | 720,000 |  |
| 45 | 6 | Creamy Pasta Twirl | Creamy Pasta | box | duet | 860,000 |  |
| 46 | 6 | Chocolate Ramen?! | Chocolate Ramen | dome | wave | 1,000,000 |  |
| 47 | 6 | Strawberry Field | Strawberry Plate | dome | spotlight | 1,200,000 |  |
| 48 | 6 | Mochi Stretch | Mochi | box | gift | 1,400,000 |  |
| 49 | 6 | Pickle Ice Cream?! | Pickle Ice Cream | dome | superchat | 1,700,000 |  |
| 50 | 6 | Legend Finale | Berry Mix | dome | duet | 2,000,000 |  |

## 5. Hoạt động tuỳ chọn (Home)
| Hoạt động | Mở | Luồng (1 món) | Nơi stream | Chi phí |
|---|---|---|---|---|
| SUPERMARKET | stream 3 | chọn 1 gói trên kệ → tự quét → stream | nhà | giá kệ 150–300 |
| DELIVERY | stream 7 | app YUMGO, 1 món chính (không có ở siêu thị) → xe giao → stream | nhà | 280–600 |
| BUFFET | stream 11 | gắp 1 phần bằng kẹp → stream | **nhà hàng** | vé 120 + 8 × level |
| COOKING | stream 15 | chọn công thức (đổi được) + topping → 2–3 bước nấu → stream | nhà | 220–340 + topping |
Mỗi hoạt động → **stream thưởng một món**: trả coin (~1,35× chi phí + thưởng), thêm món vào **Food Book**; **không tăng level**, không bao giờ bắt buộc. Thiếu coin → từ chối nhẹ nhàng, START MUKBANG vẫn miễn phí (không softlock).

## 6. Wardrobe
- Mở sau stream 6 (quà: Big Bow). Theo từng streamer (Luna / Kiko L10 / Momo L20).
- **Outfits**: My Sweater, Mint (500), Mukbang Bib (800), Sunny (quà L16), Sakura (quà L24), Chef Apron (quà L27), Star Overalls (quà L36).
- **Hair**: Big Bow (L6), Star Clip (300), Cat Ears (L19), Red Beret (900), Flower Crown (L29), Bunny Ears (L34), Star Crown (L40).
- **Extras**: Heart Stickers (400), Round Glasses (L13), Headphones (L22), Heart Glasses (L31), Cozy Scarf (L38).
- **Themed looks**: CHEF, KITTY, SUPERSTAR (đủ bộ → mặc cả bộ).
- Vẽ chồng theo khung mặt/thân của streamer (tọa độ theo `headAnchor`, `faceRadius`, `neckOnHead`) → không ảnh hưởng animation nhai. Lưu `wardrobe_json`.
- Là nơi tiêu coin chính (tổng giá mua ~2.900 coin + quà theo level).

## 7. Quảng cáo — KPI 8 impression / 5 phút (đo thật)
| Place | Loại | Vị trí | Thưởng |
|---|---|---|---|
| `stream_end` | interstitial | tap NEXT / REPLAY / HOME / AGAIN / MAIN STREAM ở màn kết quả, **từ stream 4**, bỏ nếu No Ads | — |
| `bonus_coins` | rewarded | màn kết quả, 1 lần/stream | coins (dashboard) |
| `free_coins` | rewarded | nút "+" | coins |
| `viral_boost` | rewarded (continue) | **chỉ khi gói còn niêm phong** | +25 % goal viewers, mưa tim |
| `surprise_food` | rewarded (continue) | Home | stream thưởng một món hiếm |
| `fashion_reward` | rewarded (continue) | Wardrobe | một look trong shop chưa có |
- Không bao giờ hiện ad khi đang nhai / mở gói; không có ad tự bật; không chặn tiến trình. Cooldown **30 s mỗi place** (dashboard, theo quyết định chủ dự án).
- **Đo**: `profile.ad_stats` đếm theo place: `req` (gọi showAd), `imp` + `done` (kết quả khác null), `grant` (có vật phẩm), `fail` (null/lỗi). `game.adsLast5min()` đếm impression thật trong 5 phút gần nhất (chưa có backend: đọc từ profile hoặc gửi lên khi có analytics).
- Giới hạn: kit trả `null` cho cả "không có ad" lẫn "đóng sớm" → V3 chỉ tính impression khi ad trả kết quả (đếm thận trọng).

**Kết quả mô phỏng (§9)** — với các giả định ghi trong `tools/sim-test.mjs` (fill 90 %, opt-in theo hồ sơ, interstitial 15–20 s): người chơi trung bình **~6,4 impression/5 phút**, người thích ad **~7,9**. Muốn đạt 8 cho người trung bình cần opt-in rewarded cao hơn giả định (~60–70 %) hoặc chu kỳ stream ngắn hơn. Lưu ý: 8 impression × ~20 s = **~50 % thời gian của 5 phút là quảng cáo** — cần đo retention thật trước khi chốt.

## 8. Năm phút đầu (người chơi trung bình, mô phỏng)
- 0 s: mở game → đã ở trong stream 1, gói Cat Chips trên bàn. **Chạm lần đầu < 3 s.**
- ~4 s: xé gói; ~6 s: miếng cắn đầu, rộp rộp, FIRST TASTE! (**ASMR < 10 s**).
- ~25 s: VIRAL! → kết quả (+coin, Food Book). Stream 2 (honey puffs, mặt ngọt), 3 (mì ly: kiểu bóc nắp + mở SUPERMARKET), 4 (soda: bật nắp + mặt fizzy), 5 (bánh: nắp chuông). Từ stream 4 có interstitial ở NEXT.
- ~5 phút (kể cả ad): 4–5 stream, 4 kiểu bao bì, 4 biểu cảm, SUPERMARKET đã mở; stream 6 (≈ phút 7) mở Wardrobe.

## 9. QA & mô phỏng
`node tools/sim-test.mjs` — 85 kiểm tra (mở gói, đúng 3 lượt gắp, 3 miếng/lượt, trạng thái rỗng, chỉ 1 món, chạm & kéo, thả trượt không mất lượt, 3★ bằng tim, lưu/khôi phục giữa lượt & giữa lúc nhai không trả trùng, bỏ run V1/V2 an toàn, 4 hoạt động → 1 món & không tăng level, khoá/thiếu coin, Wardrobe mua/mặc/khoá quà, ad: không ad 3 stream đầu, interstitial khi tap, cooldown, boost chỉ lúc niêm phong, không ad khi nhai, null/reject không thưởng & không tính impression, No Ads, thưởng chỉ từ SDK, dashboard 6 place × 30 s, gói ≤ 4 MB, đường sprite) + 5 hồ sơ × 50 stream:

```
persona     total(with ads)  playtime   S5      S10     S20     S30     S40     S50   side  ward  imps  imps/5min avg (min–max)  first 5 min
beginner       72'43"       41'06"   4'34"  10'47"  25'04"  39'08"  55'41"  72'43"    21     4    81   5.8 (4–8)                   4
average        78'41"       39'48"   6'23"  14'39"  31'02"  44'37"  58'07"  77'40"    25     8    98   6.4 (5–8)                   5
skilled        59'32"       29'32"   5'19"   9'25"  19'51"  31'36"  44'39"  58'15"    18     3    74   6.3 (5–7)                   5
adUser         94'44"       38'32"   7'11"  16'19"  37'51"  61'10"  76'41"  92'56"    19     7   148   7.9 (5–10)                  7
noAds          53'33"       38'25"   2'50"  10'20"  20'55"  32'03"  42'19"  51'17"    23     6    28   2.5 (1–5)                   3
```
`average ad_stats: {"bonus_coins":{"req":18,"imp":18,"done":18,"grant":18,"fail":0},"stream_end":{"req":73,"imp":65,"done":65,"grant":0,"fail":8},"viral_boost":{"req":15,"imp":14,"done":14,"grant":0,"fail":1},"fashion_reward":{"req":1,"imp":0,"done":0,"grant":0,"fail":1},"surprise_food":{"req":1,"imp":1,"done":1,"grant":0,"fail":0}}`
- playtime = thời gian chơi không tính ad; total = cả ad. "imps/5min" = impression thật (từ ad_stats) trong mọi cửa sổ 5 phút.
- Tất cả hồ sơ qua 50 stream, không blocker.

## 10. Việc tiếp theo
1. Art V3 theo `docs/ART-DIRECTION-V3.md` (nhân vật mới, 6 trạng thái gói cho 50 món, UI mới) → thay sprite, giữ fallback.
2. Gửi `ad_stats` lên analytics khi có backend; đo retention + impression thật trên TikTok.
3. Tuỳ chọn: thêm streamer thứ 4, outfit theo mùa, sự kiện fan mới cho chương 6.
