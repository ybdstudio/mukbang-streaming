# Mukbang Bang — kịch bản game hiện tại (bàn giao cho ChatGPT)

Cập nhật 03/11/2026 · repo `greenteeceo/mukbang-bang` (private), nhánh `main`.
Đọc kèm: `docs/PROGRESS.md` (tiến trình, lệnh, quy tắc HS kit) và `docs/ART-REQUEST.md` (quy cách art).

---

## 0. Bối cảnh cho người tiếp quản

- Game casual dọc (portrait) cho **TikTok Minis native** (`game.js` + canvas 2D), dùng **HS SDK kit 3.2.4 / SDK 1.1.3**. Cùng code chạy web (shim của kit) và Android.
- Ngôn ngữ trong game: **tiếng Anh**. Trao đổi với chủ dự án: **tiếng Việt**.
- Lấy cảm hứng vòng chơi từ game "Mukbang ASMR Livestream Party", nhưng **mọi hình, tên, nhân vật, số liệu là thiết kế gốc**. Không sao chép tài sản của game đó.
- Trạng thái: **v1 chơi được đủ 30 level**, đã gắn art bitmap (143 ảnh). Chưa playtest trên máy thật, chưa upload TikTok (chờ App ID).

## 1. Vòng chơi (1 level = 4 bước)

```
Home → (1) Siêu thị → (2) Quầy quét → (3) Livestream → (4) Kết quả → Next / Replay / Home
```

### Home
- Streamer đang chọn ngồi ăn trên nền của level hiện tại, logo MUKBANG BANG ở trên.
- Nút: **PLAY LEVEL n** (hoặc **RESUME STREAM** nếu có stream dở), **LEVELS**, **STREAMERS**, **SHOP**, **SOUND ON/OFF**.
- Chỉ trên TikTok: nút **ENTRY / LAUNCH** (nhiệm vụ review), **SHARE**.
- HUD: avatar + LVL, ví coin, nút **"+"** (xem quảng cáo nhận coin).

### (1) Siêu thị
- 6 kệ theo danh mục, đổi kệ bằng ‹ ›, mỗi kệ 6 món. Hàng dưới cùng xem trước kệ sắp mở (mờ + khoá).
- Chạm món → bay vào giỏ; chạm món trong giỏ → bỏ ra. Đủ N món → nút **GO**.
- Thiếu coin → không cho chọn, hiện toast và gợi ý nút "+".

### (2) Quầy quét
- Món nằm trên băng chuyền. Kéo từng món lên khe quét (hoặc chạm để món tự bay tới).
- Mỗi lần quét có tiếng beep, hoá đơn cộng dồn trên màn hình máy.
- Quét hết → trừ coin, gấu thu ngân "Thank you!" → 1,6 s sau vào stream. Lúc này stream được lưu (`run_json`).

### (3) Livestream
- Streamer ngồi sau bàn khăn caro, điện thoại gậy selfie bên trái, thanh LIVE + lượt xem + tiến độ tới goal.
- **Kéo món tới miệng** (bán kính 92 đơn vị logic) và **giữ**: cứ **0,72 s** cắn 1 miếng. Món vơi dần theo từng hình ăn dở.
- Mỗi miếng: +lượt xem, +coin (cộng thẳng vào ví), biểu cảm theo vị, âm thanh ASMR, emoji bay, dòng chat.
- Thả ra / không ăn → lượt xem tụt rất chậm về mức đầu.
- Đạt mốc lượt xem → chữ lớn "X VIEWERS!" + tip coin + confetti.
- Ăn hết → **STREAM COMPLETE!** → kết quả.
- Có nút **II** (pause): Resume / Home (giữ stream) / Sound.

### (4) Kết quả
- Sao theo **peak viewers**: 1★ hoàn thành · 2★ ≥ goal · 3★ ≥ goal3.
- Hiện coin kiếm được, **LEVEL BONUS** (chỉ lần đầu qua level), mở khoá mới (kệ / streamer).
- Nút: **WATCH AD** nhận thêm coin (1 lần), **NEXT STREAM**, **REPLAY**, **HOME**.

## 2. Nội dung

### Kệ & món (36 món — chi tiết trong `src/data.js` → `FOODS`)
| Kệ | Giá | Miếng | Mở | Món |
|---|---|---|---|---|
| NOODLES | 200 | 4 | L1 | Chili, Cheese, Mushroom, Sakura, Seafood, Black Bean Noodle |
| SNACKS | 150 | 3 | L1 | Cat Chips, Rainbow Candy, Honey Puffs, Seaweed Crisps, Choco Pretzels, Gummy Bears |
| DRINKS | 150 | 3 | L2 | Peach Milk, Banana Milk, Matcha Latte, Soda Pop, Bubble Tea, Berry Smoothie |
| CAKES | 300 | 4 | L4 | Strawberry Cake, Matcha Roll, Choco Mousse, Mango Cheesecake, Berry Tart, Rainbow Crepe |
| ICE CREAM | 250 | 3 | L6 | Mint Choc, Choco Sundae, Strawberry Swirl, Mango Sorbet, Cookie Cream, Blue Moon |
| FRUIT | 200 | 3 | L9 | Melon Jelly Bowl, Strawberry Plate, Mango Cubes, Grape Bunch, Pineapple Sticks, Berry Mix |

### Vị → hệ số & biểu cảm
| Vị | Hệ số | Biểu cảm streamer |
|---|---|---|
| savory | 1.0 | nhai (chew) |
| sweet | 1.15 | mắt tim |
| fizzy | 1.25 | mắt tròn + lấp lánh |
| sour | 1.3 | nhăn / nháy mắt |
| cold | 1.4 | run, răng zigzag, hơi lạnh |
| spicy | 1.6 | mắt > <, lè lưỡi lửa, mồ hôi, má đỏ |

Biểu cảm khác: `idle` (chớp mắt), `open` (há miệng khi món tới gần), `yum` (cười tươi).

### Streamer (chỉ khác ngoại hình)
| Tên | Mở | Ngoại hình |
|---|---|---|
| Luna | L1 | tóc tím 2 búi, nơ hồng, sweater mint |
| Kiko | L8 | tóc cam bob, kẹp sao, sweater vàng |
| Momo | L16 | tóc navy dài, beret tím, sweater hồng |

### Bối cảnh (đổi mỗi 6 level)
Sunny Park (L1–6) → Sunset Beach (L7–12) → Sakura River (L13–18) → Cozy Room (L19–24) → Neon City (L25–30).

### Chat
Câu chat theo nhóm: idle, bite, theo vị (spicy/cold/sweet/fizzy/sour/savory), finish, milestone (`{n}` viewers). 7 avatar thú: cat, dog, bunny, duck, bear, frog, pig. 7 emoji: heart, like, star, laugh, love, cool, smile.

## 3. Economy & level (công thức trong `src/data.js`)

- Coin khởi đầu **1000**.
- Mỗi miếng:
  - viewers += giá × 0.6 × hệ số vị (±15 % ngẫu nhiên)
  - coin += giá × 1.8 × hệ số vị / số miếng → **mỗi món hoàn ≥ 1,5× giá**, người chơi không bao giờ kẹt.
- Mốc viewers: 1K, 2K, 5K, 10K, 20K, 50K, 100K, 200K → tip = mốc / 20 coin.
- Level n:
  - giỏ = 3 (n ≤ 3), 4 (≤ 8), 5 (≤ 15), 6
  - viewers đầu = 400 + 300n
  - goal = làm tròn trăm(viewers đầu + 520 × giỏ)
  - goal3 = goal × 1.35
- Thưởng (từ HS dashboard, không hard-code số trong game): `level_bonus` (1 lần/level), `first_stream` (1 lần), `bonus_coins` (ad kết quả), `free_coins` (ad nút "+"), `share` (hằng ngày), 2 nhiệm vụ TikTok.
- Quảng cáo: interstitial `stream_end` khi bấm NEXT/REPLAY, **chỉ sau level 3**, bỏ qua nếu mua No Ads; cooldown 90 s. Rewarded cooldown 30 s.
- Shop (Beans): Coin pouch 1.000, Coin chest 5.000, No Ads.

## 4. Lưu tiến trình (HSGame.profile, cloud)

`level`, `levels_done`, `coins`, `streamer`, `stars_json`, `run_json` (stream dở dang → khôi phục sau khi tắt app), `streams`, `best_viewers`, `no_ads`, `sound` (chỉ máy).

## 5. Code & art

```
mukbang-bang/            GÓI TIKTOK (mọi thứ ở đây bị upload, ≤ 4 MB; hiện ~3.0 MB)
  game.js                entry: HSGame.start, profile, adapter tt.* (loadImage, touch…), wrapper hs.*
  hs-game.js, hs-sdk.min.js   file của kit — KHÔNG sửa
  src/data.js            nội dung + công thức economy/level
  src/game.js            máy trạng thái, vẽ từng màn, input kéo/thả
  src/art.js             hàm vẽ: dùng sprite nếu đã nạp, nếu chưa → bản vẽ canvas *Vec
  src/sprites.js         nạp ảnh lazy, atlas/điểm neo (theo assets/manifest.json)
  src/ui.js, audio.js, util.js
  assets/                art bitmap: food/ streamer/ bg/ store/ ui/ + manifest.json
tools/sim-test.mjs       test headless chơi trọn level (phải "all passed")
tools/build-web.mjs      build web/index.html + artifact (nhúng ảnh base64)
```

Lệnh (xem thêm `docs/PROGRESS.md` §4):
```sh
KIT=_kit/hs-sdk-1.1.3
node $KIT/hs-check.mjs mukbang-bang       # phải 0 ❌
node tools/sim-test.mjs                   # phải all passed
HS_KIT=$KIT node tools/build-web.mjs      # bản web
```

## 6. Quy tắc bắt buộc khi sửa

- Mọi lệnh `HSGame.claim/showAd/has/rewards…` viết **key literal trong `game.js`** (gốc). `showAd` chỉ gọi trong tap handler.
- Không tự cộng phần thưởng; không dùng localStorage cho tiến trình; nút phụ thuộc nền tảng chỉ vẽ khi `HSGame.has(...)`.
- Không đặt gì ngoài game vào `mukbang-bang/`. Không ghi Client Secret.
- Sau mỗi thay đổi: `hs-check` 0 ❌ và `sim-test` all passed; commit message ngắn rõ + push; không force-push.
- Giữ fallback vẽ canvas khi thêm/đổi art.

## 7. Việc tiếp theo (chưa làm)

**Gameplay (v2, đã thống nhất)**
1. **Quầy tiện lợi "nhớ đơn hàng"**: khách hiện bong bóng đơn 3 món trong vài giây, người chơi chọn lại đúng từ 3 thẻ; đếm 6/9 đơn.
2. **Khay buffet gắp bằng kẹp**: kéo kẹp gắp món từ khay vào đĩa.
3. Nhiều streamer ngồi cùng bàn, nhạc nền, rung/hiệu ứng mạnh hơn khi ăn cay/lạnh.
4. Lớp FX trôi cho nền (mây, cánh hoa, sao) bằng ảnh.

**Cần từ chủ dự án để phát hành**
- TikTok App ID → `project.config.json`; 3 ad unit id → `mukbang-bang.hs-dashboard.json`; HS Game ID + SDK key → `HSGame.start` trong `game.js`.

**Rủi ro**
- Độ khó/economy mới cân bằng bằng công thức, cần chơi thật để chỉnh.
- Chưa test trên máy thật / TikTok DevTool (bộ nhớ ảnh nền lớn 1080×2400; game chỉ giữ 3 nền trong RAM).
