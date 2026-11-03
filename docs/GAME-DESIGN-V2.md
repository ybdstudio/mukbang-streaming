# Mukbang Bang V2 — thiết kế gameplay (Phase 1: audit + design)

Ngày 03/11/2026 · trạng thái: **Phase 1 đã duyệt · Phase 2 xong** (xem §16).
Nguồn yêu cầu: brief "Mukbang Bang V2.0 — Gameplay & Monetization Overhaul" + "Four Food Sources Update".
Theo chủ dự án: **bỏ phần KPI quảng cáo (8 impression / 5 phút) và hệ thống tracking/analytics** khỏi phạm vi V2.

Đọc kèm: `docs/GAME-SCRIPT.md` (bản V1), `docs/PROGRESS.md`, `docs/ART-REQUEST.md`.

---

## 1. Audit bản V1 (commit `9646e31`)

### 1.1 Máy trạng thái hiện tại (`src/game.js`)
```
home ──play──▶ market ──GO──▶ checkout ──quét xong + 1.6 s──▶ stream ──hết món──▶ result ──next/replay──▶ market
  │                                                              ▲                    └──home──▶ home
  ├─▶ levels / streamers / hsshop / popup(coins)                 └── restoreRun() từ run_json khi mở lại app
  └─ pause (overlay trong stream)
```
States: `home, levels, streamers, hsshop, popup, market, checkout, stream, pause, result`. 1 file `Game` (670 dòng), vẽ immediate-mode (`ui.js`), mỗi màn có `drawX()` + xử lý tap/drag.

### 1.2 Hệ thống có sẵn
| Hệ thống | V1 | Dùng lại cho V2 |
|---|---|---|
| Kéo món tới miệng, cắn theo nhịp 0,72 s, món vơi dần theo stage | ✅ | **giữ nguyên**, là lõi |
| Biểu cảm streamer 9 loại (sprite ghép lớp) | ✅ | giữ, thêm phản ứng combo/cay/mystery bằng cách kết hợp mắt+miệng+fx sẵn có |
| Viewers, mốc tip, confetti, emoji, chat | ✅ | giữ, mở rộng chat thành **Fan Request** |
| Siêu thị 6 kệ / 36 món + giỏ + quét mã | ✅ | thành **chế độ Supermarket**; quét mã chuyển thành tự động + mini-game thỉnh thoảng |
| 30 level theo công thức `level(n)` | ✅ | thay bằng **bảng dữ liệu 30 level** (`src/levels.js`) |
| Economy: mỗi món hoàn ≥ 1,5× giá | ✅ | giữ nguyên tắc, tính lại cho 4 chế độ |
| HS kit: profile cloud, 3 ad place, shop, TikTok missions, pause/resume | ✅ | giữ nguyên kiến trúc, thêm ad place mới (§8) |
| Art bitmap 143 ảnh + fallback canvas | ✅ | giữ; art mới đi qua cùng `sprites.js` |
| `run_json` khôi phục stream dở | ✅ | mở rộng (version 2), vẫn đọc được bản 1 |

### 1.3 Điểm yếu của V1 (lý do làm V2)
- 1 level ≈ 60–90 s nhưng **≈ 45 % thời gian là đi chợ + quét mã**; phần stream chỉ là kéo–giữ lặp lại.
- Không có kỹ năng/quyết định trong stream → 30 level cảm giác giống nhau; streamer chỉ khác ngoại hình.
- Level 1 bắt đầu bằng siêu thị → tương tác đầu tiên có "cảm giác" (ASMR) đến sau ~25 s.
- Coin dư dần, không có chỗ tiêu ngoài mua đồ ăn.

### 1.4 Ràng buộc kỹ thuật phải giữ
- HS kit 3.2.4 / SDK 1.1.3; không sửa `hs-game.js`, `hs-sdk.min.js`; key literal trong `game.js`; `showAd` chỉ trong tap handler; game không tự quyết giá trị phần thưởng (số coin của ad/claim nằm trong dashboard).
- Canvas 2D native TikTok + web shim; profile keys cũ giữ nguyên ý nghĩa.
- **Gói chính ≤ 4 MB** (hiện ~3,0 MB). Art mới (§10) sẽ vượt → dùng `game.json` `subpackages` (TikTok cho tổng 30 MB) — xem §11.

---

## 2. Mục tiêu sản phẩm V2

| Mục tiêu | Thiết kế đáp ứng |
|---|---|
| Tương tác đầu tiên ≤ 3 s | L1 mở thẳng vào stream, món đã bày trên bàn, ngón tay hướng dẫn kéo |
| Phản ứng ASMR đầu tiên ≤ 10 s | miếng cắn đầu tiên ~4–6 s |
| Qua L1 ≈ 30–40 s | L1: 3 món × 3 miếng, goal thấp |
| 5 level khác nhau trong ~5 phút | L1–L5 = 4 nguồn đồ ăn + Mystery Box, mỗi level 1 cơ chế mới |
| 3 phần thưởng/mở khoá đáng nhớ trong 5 phút | L2 app Delivery, L3 thẻ Buffet, L4 Bếp nhà, L5 Mystery Box (§6) |
| Tổng ~40 phút cho 30 level | §5.3: L6 5′ · L12 12′ · L18 20′ · L24 29′ · L30 40′ (mục tiêu thiết kế, đo bằng mô phỏng §12) |
| Không có rewarded ad bắt buộc | mọi ad là nút tuỳ chọn (§8) |

Mọi con số thời gian ở đây là **mục tiêu thiết kế**; thời gian thật phải đo bằng playtest người.

---

## 3. Vòng chơi mới

```
              ┌───────────────────── chọn tự động theo level (bảng §5) ─────────────────────┐
Home ─PLAY─▶  │ SUPERMARKET │ DELIVERY APP │ BUFFET │ DIY KITCHEN │   (L1: bỏ qua, vào stream luôn)
              └──────┬──────────────┬──────────┬───────────┬──────┘
                     ▼              ▼          ▼           ▼
             (checkout tự động) (giao hàng + mở hộp) (gắp + xếp đĩa) (nấu + trang trí)
                     └──────────────┴────┬─────┴───────────┘
                                         ▼
                        LIVESTREAM (ở nhà; Buffet: tại nhà hàng)
                                         ▼
                             REWARD (sao, coin, mở khoá) ──NEXT──▶ level sau
```
- **Mỗi level có 1 nguồn đồ ăn mặc định** (dữ liệu level). Từ L5, ở màn Home có nút đổi nguồn ("Change food source") cho các nguồn đã mở, khi chơi lại hoặc chơi tự do — tạo đa dạng mà không bắt người mới phải chọn.
- **Chuyển cảnh nhanh**: wipe/zoom 0,35 s, không màn loading riêng; art chế độ mới được nạp trước khi người chơi đến (§11).
- **Thời lượng mục tiêu**: L1–6: 35–60 s/level; L7–18: 60–80 s; L19–30: 80–120 s (thêm vòng/sự kiện, không thêm số miếng nhai).

### 3.1 State machine V2
```
home → source(mode) → [checkoutRush?] → golive(0.4 s) → stream → result → next
source(mode) ∈ market | delivery | buffet | kitchen
delivery: deliveryMenu → deliveryArrive (≈3 s) → unbox
buffet:   buffetLine → plate (xếp đĩa) ; stream dùng bối cảnh nhà hàng
kitchen:  kitchenShop (chọn bộ nguyên liệu) → prep steps (8–15 s) → plating
```
State mới: `delivery, arrive, buffet, kitchen, golive, checkoutRush`. `market` & `checkout` giữ, nhưng checkout thường là tự động (§4.1).

---

## 4. Bốn nguồn đồ ăn

Mỗi nguồn có **catalog riêng, giao diện riêng, thao tác riêng**. Không dùng chung catalog.

### 4.1 SUPERMARKET — đồ đóng gói (đã có, chỉnh lại)
- Catalog: 36 món hiện có (6 kệ). Nhận diện: kệ hàng, bao bì, giá dán kệ.
- Thao tác: chạm món → bay vào giỏ (giữ nguyên). **Bỏ quét mã bắt buộc**: bấm GO → hàng tự trượt qua máy quét, beep beep, trả tiền (≈1,5 s, chạm để tua).
- **Checkout Rush** (mini-game thỉnh thoảng, L12/L20/L26): 8 s quét càng nhanh càng được tip; không có fail.
- Mới: hộp **Mystery Box** trên kệ (từ L5), món **"Party pack"** (L12).
- Livestream: **ở nhà**.
- Giá: rẻ nhất (100–250/món), 3 miếng/món → nguồn "an toàn" khi ít coin.

### 4.2 FOOD DELIVERY — món nhà hàng (mới)
- Giao diện: màn hình **điện thoại app giao đồ ăn** (khung phone bo tròn, tab nhà hàng, thẻ món có ảnh + giá + nhãn "HOT/NEW").
- Luồng (≈ 12–18 s, **không chờ thời gian thật**):
  1. Chọn nhà hàng (tab danh mục) → 2. chọn **món chính** (bắt buộc, 1–2 món theo level) → 3. **món phụ** tuỳ chọn (+ giá nhỏ) → 4. **ORDER** → 5. hoạt cảnh giao hàng ≈ 3 s: xe máy chạy tới cửa, "ding dong", túi giao hàng đặt xuống → 6. **mở hộp**: chạm/kéo nắp hộp, hơi nóng bốc lên, món "pop" ra bàn → stream.
- Catalog (10 món chính, 5 nhà hàng; mỗi món 4–5 miếng, nhiều "hype" hơn siêu thị):

| Nhà hàng | Món chính | Vị / tag | Mở |
|---|---|---|---|
| Chicken Joy | Korean Fried Chicken | savory · crunchy · fried | L2 |
| Chicken Joy | Cheese Burger | savory · fried | L2 |
| Mamma Pizza | Pizza (4 lát) | savory · cheesy | L8 |
| Mamma Pizza | Creamy Pasta | savory · slurpy | L8 |
| Seoul Street | Tteokbokki | **spicy** · chewy | L11 |
| Seoul Street | Dumplings | savory · chewy | L11 |
| Tokyo Box | Sushi Set | **cold** · fresh | L14 |
| Tokyo Box | Curry Rice | savory · spicy-mild | L14 |
| Hot & Boil | Mini Hotpot | **spicy** · slurpy | L19 |
| Hot & Boil | Seafood Boil | spicy · messy (5 miếng) | L24 |

- Món phụ (6): Cola (drink, fizzy), Fries (crunchy), Cheese Sticks (cheesy), Pickled Radish (sour, làm dịu cay), Miso Soup (drink, giảm cay), Mochi (sweet).
- Livestream: **ở nhà**, món bày trong hộp/khay giao hàng.
- Giá: cao (250–600 món chính, 60–150 món phụ) nhưng hype/miếng cao nhất.

### 4.3 BUFFET RESTAURANT — gắp bằng kẹp (mới)
- Giao diện: quầy buffet nhìn ngang, 2 hàng khay inox (mỗi khay 1 món), **kẹp gắp** (tongs) và **đĩa** ở dưới.
- Phí vào cửa cố định theo level (vé buffet) → gắp tối đa N phần (số ô trên đĩa).
- Thao tác (≈ 12–15 s):
  1. Kéo kẹp tới khay → kẹp "kẹp" món (rung nhẹ, tiếng click) → kéo về đĩa → thả vào ô. Chạm khay = kẹp tự gắp (dễ cho người mới).
  2. **Xếp đĩa**: đủ ô → "Plate bonus" nếu đĩa đa dạng (≥ 3 vị khác nhau) hoặc đúng "Chef's theme" (vd. toàn món cay) → +hype khởi đầu.
- Trạm buffet (mỗi trạm 6 phần ăn, catalog riêng dạng phần đĩa nhỏ):

| Trạm | Món | Mở |
|---|---|---|
| Hot Station | Spicy Wings, Kimchi Fried Rice, Fish Cake Skewer, Fried Shrimp, Mapo Tofu, Spring Rolls | L3 |
| Dessert & Ice Bar | (dùng lại art cakes + ice cream đã có, bày dạng buffet) | L6 |
| Sushi & Cold Bar | Salmon Nigiri, Cold Soba, Tamago, Seaweed Salad, Ice Jelly, Melon Slice | L10 |
| Hotpot Corner | Beef Slices, Mushroom Mix, Fish Balls, Corn, Udon, Tofu Puff | L13 |
| Grill Station | Mini Steak, Grilled Corn, Sausage, Yakitori, Garlic Bread, Grilled Squid | L17 |
| Lava Spicy Station | Ghost Pepper Wings, Fire Noodles, Spicy Rice Cake, ... | L22 |

- Livestream: **trong nhà hàng** (bối cảnh buffet; đèn ấm, khách mờ phía sau).
- Giá: vé 300 → ~650; đáng tiền nhất khi xếp đĩa tốt.

### 4.4 DIY COOKING — nấu tại nhà (mới)
- Giao diện: **bếp nhà** (mặt bàn bếp, nồi/chảo, bát đĩa).
- Luồng:
  1. **Mua nguyên liệu**: chọn 1 "recipe kit" (bộ nguyên liệu đóng sẵn, 1 chạm) + **topping tuỳ chọn** (có giá) — không bắt đi lại siêu thị.
  2. **Chuẩn bị** 8–15 s, 2–3 bước, mỗi bước 1 thao tác đơn giản:
     - đổ/thả (kéo nguyên liệu vào nồi), khuấy (vẽ vòng tròn), lắc (kéo qua lại), rắc/trang trí (chạm vị trí), rót (giữ).
  3. **Trình bày**: món hoàn thành "ta-da" + điểm sáng tạo (số topping khác nhau) → +hype khởi đầu.
- Công thức (mỗi công thức tạo 1–2 món ăn được trong stream):

| Công thức | Bước | Món ra (art) | Mở |
|---|---|---|---|
| Decorate a Cake | phết kem → đặt topping → rắc cốm | bánh trang trí (art cakes + lớp topping) | L4 |
| Custom Ramen | thả mì → khuấy → thêm trứng/hành/phô mai | mì ly (art noodles + topping) | L7 |
| Make My Boba | rót trà → thêm sữa → thả trân châu → lắc | bubble tea (art có sẵn + lớp topping) | L9 |
| Rainbow Dessert | xếp 5 lớp màu → kem → topping | parfait cầu vồng | L15 |
| Party Plate (bento) | xếp cơm, trứng cuộn, gà, rau vào ô | đĩa bento | L18 |
| Surprise Dessert | trộn 2 nguyên liệu bí ẩn → nướng → mở | món bất ngờ (pool Mystery) | L23 |
| Crispy Fry | nhúng bột → chiên (giữ đúng lúc) → để ráo | tempura / gà chiên giòn | L27 |

- Livestream: **ở nhà**.
- Giá: rẻ hơn mua sẵn (~60 % giá tương đương) + thưởng sáng tạo; đổi lại tốn thời gian chuẩn bị.

### 4.5 Bối cảnh stream
- **Nhà** (Supermarket, Delivery, DIY): phòng stream của streamer; **cửa sổ đổi cảnh theo chương** — tái dùng 5 nền hiện có (park, beach, sakura, room-night, city) làm cảnh ngoài cửa sổ. Cần 1 art mới: khung phòng có ô cửa sổ trong suốt (§10).
- **Nhà hàng** (Buffet): 1 nền mới; đổi tông đèn theo chương bằng lớp màu (không cần 5 art).

---

## 5. Livestream: cơ chế mới

Giữ nguyên kéo món tới miệng + giữ để cắn. Thêm:

### 5.1 ASMR Combo
- Mỗi miếng cắn liên tiếp (khoảng cách ≤ 2,5 s; Momo: 3,5 s) +1 combo. Thanh combo + số "×12" cạnh mặt streamer.
- **Perfect bite**: lúc cắn, tâm món nằm trong **vùng miệng trong** (bán kính 44, vùng ăn ngoài vẫn 92) → chữ "PERFECT!", vòng sáng, âm thanh crunch to hơn. Dễ với ngón tay, không cần canh nhịp.
- Hệ số viewers: combo 5 → ×1,2 · 10 → ×1,5 · 20 → ×2,0 · 30 → ×2,5 (trần).
- Mốc nhỏ mỗi 5 combo: popup chữ ("CRUNCH ×5!"), confetti nhỏ, chat dồn.
- Reset: ngừng ăn > 2,5 s, hoặc tràn cay (§5.2). Reset chỉ là mất hệ số, không phạt viewers.

### 5.2 Spicy Challenge
- Thanh cay 0–100 dưới thanh LIVE. Miếng cay: +14 × độ cay (1–3). Tự giảm 5/giây.
- **Đồ uống**: −35; **lạnh**: −20; **chua (dưa củ cải)**: −15.
- ≥ 60 **ON FIRE**: lửa animation quanh đầu, má đỏ (đã có), viewers ×1,3, chat "FIRE FIRE".
- 100 **TOO HOT!**: phản ứng hài 1,5 s (mắt > <, lè lưỡi, khói tai), combo reset, thanh về 40. **Không thua**.

### 5.3 Fan Requests
- Bong bóng yêu cầu ghim trên cùng (chữ to ≥ 22 px + icon), đếm ngược 10 s: "EAT THE SPICY ONE!", "TRY SOMETHING COLD!", "WE WANT CRUNCHY!", "DRINK SOMETHING!", "SWEET TIME!", "NOODLE SLURP!".
- Chỉ yêu cầu tag **có trên bàn**. Đúng → +viewers bùng (≈ 8 % goal), tim bay, chat "YESSS". Hết giờ → "aww" nhẹ, không phạt.
- Biến thể: **Fan voting** (L13, 2 lựa chọn, thanh phiếu chạy 4 s → bên thắng thành yêu cầu ×2), **Multi-request** (L12, 2 bong bóng), **Order Rush** (L21, 3 yêu cầu liên tiếp nhanh).

### 5.4 Mystery Food
- Hộp quà trên bàn; **chạm** để mở (lắc 0,4 s → pop) → món ngẫu nhiên từ **pool theo level** (bảng trong `levels.js`):

| Kết quả | Tỉ lệ gốc | Hiệu ứng |
|---|---|---|
| Delicious | 45 % | món ngon thường của nguồn hiện tại |
| Super Spicy | 20 % | cay ×3 → thử thách "ăn hết trong 8 s" = bonus |
| Frozen | 15 % | lạnh, phản ứng đóng băng, combo +3 |
| Rare Dessert | 12 % | món vàng lấp lánh, coin ×2 cho món này |
| Funny Combo | 8 % | "Chocolate Ramen", "Pickle Ice Cream"… → biểu cảm chua+ngọt luân phiên, chat cười, viewers +15 % |

- Pool có "pity": không quá 2 lần Delicious liên tiếp. Mega Mystery (L26): 3 hộp, chọn 1.

### 5.5 Duo Mukbang (từ L16)
- 2 streamer cùng khung (đầu scale 0,8, đặt ở 30 % và 70 % chiều ngang), **mỗi người 1 vùng miệng**; vẫn chỉ 1 thanh combo chung.
- **Duo combo**: cho 2 người ăn xen kẽ trong 2 s → "DUO!" +25 % viewers miếng đó.
- Chọn cặp ở màn Streamers (main + partner). Khi duo, giảm chat còn 2 dòng để không rối.

### 5.6 Năng lực streamer (cân bằng ~ +10 % mỗi người trong điều kiện thuận lợi)
| Streamer | Năng lực | Mạnh khi |
|---|---|---|
| Luna | Perfect bite +15 % viewers | người chơi chính xác |
| Kiko | món ngọt: +20 % coin và tim bay | level nhiều đồ ngọt (DIY, dessert) |
| Momo | món lạnh: cửa sổ combo +1 s, lạnh giảm cay thêm 10 | level cay, sushi/ice |

Không năng lực nào là bắt buộc để qua level (goal tính với hệ số 1,0).

---

## 6. Ba mươi level (dữ liệu, không hard-code)

### 6.1 Schema (`src/levels.js`)
```js
{ n: 4, chapter: 1, title: 'Fans Choose My Food', mode: 'kitchen', recipe: 'decorate_cake',
  location: 'home', targetSec: 60,
  mechanics: ['combo', 'requests'],          // bật dần theo level
  pool: { kits: ['decorate_cake'], toppings: ['strawberry', 'cream', 'sprinkles'] },
  dishes: 2,                                  // số món lên bàn
  startViewers: 1500, goal: 3600, goal3: 4900,
  events: [ { t: 6, type: 'request', tag: 'sweet' }, { t: 18, type: 'request', tag: 'drink' } ],
  firstClear: 'level_bonus',                 // key literal trong game.js
  unlocks: ['cakes_shelf'],
  adOptions: ['double_coins'],                // §8 — chỉ là nút tuỳ chọn
  tutorial: 'requests' }
```
Sao: 1★ xong stream · 2★ đạt `goal` · 3★ đạt `goal3` (= goal × 1,35). Không có thua.

### 6.2 Bảng 30 level
Goal viewers tăng theo log: 800 → 10K (L6) → 100K (L18) → 1M (L29) → 1,5M (L30).

| # | Tên | Nguồn | Nơi stream | Thời lượng | Cơ chế chính | Mở khoá / thưởng |
|---|---|---|---|---|---|---|
| **Ch.1 — ROOKIE STREAMER** |||||||
| 1 | First Viral Bite | Supermarket (bày sẵn) | Nhà · Park | 35 s | kéo–cắn, phản ứng ASMR | Goal 800 · +coin khởi đầu |
| 2 | Crunchy Combo | **Delivery** (Fried Chicken + Cola) | Nhà | 50 s | ASMR Combo, đồ uống | **App Delivery**, Chicken Joy |
| 3 | Too Spicy! | **Buffet** (Hot Station) | Nhà hàng | 55 s | Spicy meter, đồ uống giảm cay | **Thẻ Buffet** |
| 4 | Fans Choose My Food | **DIY** (Decorate a Cake) | Nhà | 60 s | Fan Requests, bánh | **Bếp nhà**, kệ Cakes |
| 5 | Mystery Box | Supermarket (+Mystery) | Nhà | 50 s | Mystery Food | Mystery Box, đổi nguồn ở Home |
| 6 | First 10K Fans | Buffet (Dessert & Ice Bar) | Nhà hàng | 60 s | thử thách combo 10, kem | Cúp "10K", trang trí phòng #1 |
| **Ch.2 — RISING STAR** |||||||
| 7 | Sweet vs Sour | DIY (Custom Ramen) | Nhà · Beach | 65 s | phản ứng vị, so ngọt/chua | công thức Ramen |
| 8 | Meet Kiko | Delivery (Mamma Pizza) | Nhà | 65 s | năng lực Kiko | **Kiko**, Pizza & Pasta |
| 9 | Make My Boba | DIY (Make My Boba) | Nhà | 70 s | chuẩn bị (lắc/rót), trái cây | công thức Boba, kệ Fruit |
| 10 | Frozen Face | Buffet (Sushi & Cold Bar) | Nhà hàng | 70 s | phản ứng lạnh | trạm Sushi |
| 11 | Perfect ASMR | Delivery (Seoul Street) | Nhà | 70 s | perfect-bite streak | Tteokbokki, Dumplings |
| 12 | First Fan Party | Supermarket (Party pack) + Checkout Rush | Nhà | 75 s | 2 yêu cầu cùng lúc | trang trí phòng #2 |
| **Ch.3 — VIRAL QUEEN** |||||||
| 13 | Hot or Cold? | Buffet (Hotpot Corner) | Nhà hàng | 75 s | Fan voting | trạm Hotpot |
| 14 | Mystery Roulette | Delivery (Tokyo Box, Mystery meal) | Nhà · Sakura | 75 s | thử thách bất ngờ | Sushi Set, Curry |
| 15 | Rainbow Dessert | DIY (Rainbow Dessert) | Nhà | 80 s | trang trí nhiều lớp | công thức Rainbow |
| 16 | Meet Momo | Delivery (pizza cỡ lớn) | Nhà | 80 s | **Duo Mukbang** | **Momo**, chế độ Duo |
| 17 | Double Trouble | Buffet (Grill Station) | Nhà hàng | 80 s | Duo combo | trạm Grill |
| 18 | 100K Celebration | DIY (Party Plate) | Nhà | 85 s | Fan frenzy (yêu cầu dày) | Cúp "100K", trang trí #3 |
| **Ch.4 — MUKBANG CELEBRITY** |||||||
| 19 | Cozy Night Live | Delivery (Hot & Boil: Mini Hotpot) | Nhà · Night | 85 s | cay + đồ uống | Mini Hotpot |
| 20 | Speed Snack | Supermarket + Checkout Rush | Nhà | 80 s | chuỗi món nhanh, combo dài | kệ Party |
| 21 | Fan Order Rush | Delivery (fans đặt món) | Nhà | 90 s | Order Rush 3 yêu cầu | — |
| 22 | Super Spicy Battle | Buffet (Lava Spicy) | Nhà hàng | 90 s | Duo thi cay | trạm Lava |
| 23 | Sweet Surprise | DIY (Surprise Dessert) | Nhà | 90 s | Mystery trong bếp | công thức Surprise |
| 24 | Celebrity Collab | Delivery (Seafood Boil) | Nhà | 95 s | Duo + requests | Seafood Boil, trang trí #4 |
| **Ch.5 — SUPERSTAR LIVE** |||||||
| 25 | Neon City Debut | Buffet (tất cả trạm) | Nhà hàng · Neon | 100 s | combo + cay | trạm tự chọn |
| 26 | Mega Mystery Box | Supermarket (3 hộp bí ẩn) | Nhà · City | 100 s | Mega Mystery | — |
| 27 | ASMR Master | DIY (Crispy Fry) | Nhà | 105 s | perfect streak 15 | công thức Crispy |
| 28 | Ultimate Food Mix | Delivery + món phụ tự chọn | Nhà | 110 s | 2 vòng (vòng 2 món mới mở khi hết vòng 1) | — |
| 29 | Million Viewer Race | Buffet + yêu cầu liên tục | Nhà hàng | 115 s | đua 1M viewers | — |
| 30 | Superstar Finale | **3 vòng: Buffet → DIY → Delivery** | đổi theo vòng | 120 s | mọi cơ chế, Duo | Cúp Superstar, chế độ tự do |

Chi tiết từng level (pool món, start viewers, goal, sự kiện theo giây) sẽ nằm trong `src/levels.js` ở Phase 2–3; bảng goal theo mô hình §7.

### 6.3 Nhịp tiến trình (mục tiêu thiết kế)
| Mốc | Tổng thời lượng level (theo bảng) + chuyển cảnh ~8 s/level | Mục tiêu brief |
|---|---|---|
| L6 | 310 s + 48 s ≈ **6,0′** | 5′ → cần cắt ~1′ (rút prep L4, giảm món L6) |
| L12 | 725 s + 96 s ≈ **13,7′** | 12′ |
| L18 | 1200 s + 144 s ≈ **22,4′** | 20′ |
| L24 | 1730 s + 192 s ≈ **32,0′** | 29′ |
| L30 | 2380 s + 240 s ≈ **43,7′** | 40′ |
Bảng hiện dài hơn mục tiêu ~9 %. Phase 2 sẽ đo bằng mô phỏng thời gian người (§12) và cắt số món/sự kiện cho khớp, **không** thêm thời gian chờ.

---

## 7. Economy V2

### 7.1 Nguyên tắc
- Coin khởi đầu **500** (V1: 1000) + L1 miễn phí (món bày sẵn) → món ăn mua bằng coin bắt đầu từ L2.
- Mỗi lần stream hoàn ≥ **1,35×** chi phí tối thiểu, kể cả người chơi kém → **không bao giờ kẹt**.
- **Lưới an toàn**: nếu coin < chi phí tối thiểu của level → hiện nút "Fan care package" (miễn phí, đồ siêu thị cơ bản, thu nhập thấp hơn nhưng dương). Không cần xem ad.
- Món đắt / topping / món phụ = **đa dạng và hype**, không bắt buộc.
- Thưởng qua level lần đầu (`level_bonus`) chỉ 1 lần/level (giữ `levels_done`). Chơi lại: chỉ coin từ ăn → không farm nhanh được (mỗi lần chơi lại tốn ≥ 45 s, lãi ~ 0,35–0,5× chi phí).
- **Chỗ tiêu coin mới** (mô hình cho thấy V2 dư ~17K coin ở L30): **Trang trí phòng stream** (đèn, gấu bông, poster, khung LIVE) — thuần mỹ quan, mỗi món 500–3000; topping/món phụ cao cấp.

### 7.2 Chi phí tối thiểu theo nguồn
| Nguồn | Chi phí tối thiểu | Thu (trung bình) | Ghi chú |
|---|---|---|---|
| Supermarket | 180 → ~400 | ×1,55 | an toàn, rẻ |
| Delivery | 320 → ~720 | ×1,55 + hype cao | đắt, món chính 4–5 miếng |
| Buffet | vé 300 → ~650 | ×1,55 + Plate bonus | vé cố định, tối ưu bằng xếp đĩa |
| DIY | 220 → ~480 | ×1,55 + Creative bonus | rẻ, tốn thời gian chuẩn bị |

### 7.3 Mô phỏng sơ bộ 30 level (chi phí tối thiểu, chưa tính tiêu trang trí)
Hệ số thu: beginner ×1,35 · average ×1,55 · skilled ×1,8; thưởng qua level = 100 + 15n.

| Level | Nguồn | Goal | Chi phí min | Coin sau level (avg) |
|---|---|---|---|---|
| 1 | Supermarket | 800 | 0 | 765 |
| 2 | Delivery | 1.300 | 320 | 1.071 |
| 3 | Buffet | 2.200 | 310 | 1.386 |
| 4 | DIY | 3.600 | 240 | 1.678 |
| 6 | Buffet | 10.000 | 380 | 2.362 |
| 12 | DIY | 30.000 | 320 | 4.955 |
| 18 | Delivery | 100.000 | 550 | 8.296 |
| 24 | DIY | 300.000 | 440 | 12.419 |
| 30 | Delivery | 1.500.000 | 720 | 17.297 |
Số dư thấp nhất sau khi trả tiền: **445 coin (cả 3 hồ sơ)** → không softlock. Cuối game dư 15–20K → bù bằng trang trí phòng (tổng giá ~15K). Phase 2 thay mô hình này bằng mô phỏng chạy thật trong `sim-test`.

---

## 8. Quảng cáo (không có KPI, không tracking)

Theo chủ dự án: **bỏ mục tiêu 8 impression/5 phút và hệ thống đo event**. Chỉ giữ thiết kế điểm đặt ad đúng luật HS kit:
- Mọi `showAd` chỉ trong tap của nút; không tự bật rewarded; không chen khi đang nhai/chuẩn bị; không chặn tiến trình bằng ad; cooldown nằm trong dashboard; game **không tự quyết giá trị thưởng** (nên "Double coins" hiển thị số coin cố định từ `HSGame.rewards(place)` thay vì "×2").

| Place (mới = *) | Loại | Vị trí | Thưởng (dashboard) |
|---|---|---|---|
| `stream_end` | interstitial | tap NEXT/REPLAY, từ **L7** (V1: L4), bỏ qua nếu No Ads | — |
| `bonus_coins` (đổi nhãn "Stream Bonus") | rewarded | màn kết quả, 1 lần/stream | coins |
| `free_coins` | rewarded | nút "+" cạnh ví | coins |
| `mystery_bonus` * | rewarded | màn kết quả: mở thêm 1 hộp bí ẩn (vật phẩm cho stream sau) | `mystery_box: 1` |
| `fan_gift` * | rewarded | màn kết quả khi đạt 3★ | coins (nhỏ) + tim |
| `viral_boost` * | rewarded | màn "Go live" trước stream: bắt đầu với viewers cao hơn | `viral_boost: 1` (profile field) |
| `bonus_food` * | rewarded | màn chọn nguồn: thêm 1 món miễn phí | `bonus_food: 1` |
| `retry` * | rewarded, không thưởng | kết quả < 2★: chơi lại level, **không tốn tiền đồ ăn** | — (`{}` → tiếp tục) |

Các key mới cần thêm vào `DEFAULTS` + `mukbang-bang.hs-dashboard.json`; ad unit id do chủ dự án cung cấp.

---

## 9. UI/UX
- Stream là trọng tâm: mặt streamer + món chiếm ~60 % màn hình.
- HUD stream (trên cùng, 1 hàng): LIVE + viewers (chữ to hơn: 26 px) · coin · pause. Dưới: thanh goal, **thanh combo** (cạnh phải mặt), **thanh cay** (chỉ hiện khi level bật cay).
- Fan request: 1 bong bóng lớn, không quá 2 cùng lúc; chat giảm còn 3 dòng (Duo: 2).
- Màn chọn nguồn: 1 màn, ≤ 3 nút chính; thẻ món ≥ 110 px, giá rõ.
- Phần thưởng: màn kết quả có "reveal" (sao bật, coin bay vào ví, thẻ mở khoá lật) ≤ 2,5 s, chạm để tua.
- Không thêm popup ngoài: hướng dẫn = ngón tay động + 1 dòng chữ, chỉ lần đầu mỗi cơ chế.

---

## 10. Art cần thêm (sẽ viết `docs/ART-REQUEST-V2.md` sau khi duyệt)

Tái dùng tối đa: 36 món siêu thị, 3 streamer + bộ mặt, 5 nền (thành cảnh cửa sổ), icon/emoji/avatar, giỏ, máy quét.

| Nhóm | Số lượng (ước) | Ghi chú |
|---|---|---|
| Delivery: 10 món chính × 4–5 stage | ~45 frame | 256×256 như món hiện tại |
| Delivery: 6 món phụ × 3 stage | 18 | |
| Delivery UI: khung app điện thoại, 5 logo nhà hàng, thẻ món | ~8 | logo nhà hàng là **thương hiệu hư cấu** |
| Delivery: xe giao hàng + túi + hộp (đóng/mở) | ~5 | hoạt cảnh 3 s |
| Buffet: quầy + khay, kẹp, đĩa có ô, nền nhà hàng | ~5 | |
| Buffet: 5 trạm mới × 6 phần ăn × 3 stage | ~90 | trạm Dessert dùng lại art cũ |
| DIY: nền bếp, nồi/chảo/bát | ~4 | |
| DIY: nguyên liệu + topping (~30) | ~30 | ảnh nhỏ 128×128 |
| DIY: món thành phẩm mới (Rainbow parfait, Bento, Surprise, Crispy fry) × stage | ~16 | ramen/boba/bánh dùng lại art cũ + lớp topping |
| Nhà: khung phòng stream có ô cửa sổ trong suốt | 1–2 | ghép với 5 nền hiện có |
| Trang trí phòng (cosmetic) | ~12 | tuỳ chọn, có thể để sau |
| Mystery box, hiệu ứng lửa/khói/đá, vòng Perfect | ~8 | |
| **Tổng** | **~240 ảnh, ~4–5 MB** | |

Mọi thứ mới có **fallback canvas** (hình đơn giản cùng bảng màu) để game chơi được trước khi có art.

---

## 11. Kỹ thuật

- **Gói**: main package (≤ 4 MB) = code + art Ch.1 cần ngay (siêu thị, Chicken Joy, Hot Station, Decorate Cake, nhà, nhà hàng). Phần còn lại vào subpackage `art2/` (`game.json` → `subpackages`), nạp bằng `tt.loadSubpackage` lúc ở Home/kết quả (cần kiểm `hs-check` và web shim hỗ trợ — rủi ro kỹ thuật số 1, kiểm đầu Phase 2).
- **Mã nguồn**: tách `src/game.js` (đang 670 dòng) thành module theo màn: `scenes/market.js, delivery.js, buffet.js, kitchen.js, stream.js, result.js`; `src/levels.js` (30 level), `src/catalog.js` (4 catalog), `src/stream-mech.js` (combo, cay, request, mystery, duo — thuần logic, test được headless).
- **Profile** (giữ key cũ): thêm `combo_best`(max), `unlocks_json`, `decor_json`, `mystery_box`, `viral_boost`, `bonus_food`, `duo_partner`. `run_json` v2 lưu `mode`, món + stage, combo, cay; đọc được run v1 (coi là Supermarket).
- **Không sửa** hs-game.js / hs-sdk.min.js; mọi key ad/claim literal trong `game.js`.

## 12. Kế hoạch test (`tools/sim-test.mjs`)
- Bot chơi **cả 30 level** qua input thật; mỗi thao tác có **chi phí thời gian người** theo hồ sơ (tap 0,6–1,2 s, kéo 1,0–1,8 s, đọc chữ 1,5 s…) → báo cáo **thời gian người ước tính**, tách khỏi thời gian bot.
- Hồ sơ: Beginner, Average, Skilled, Rewarded-ad user, No-ad user. Báo: thời gian tới L3/6/12/18/24/30, số tương tác, số dư coin, blocker.
- Ca riêng: coin thấp (lưới an toàn), món kết hợp khác nhau, bỏ lỡ fan request, tràn cay, reset combo, đủ 5 kết quả mystery, Duo, khôi phục stream (v1 và v2), ad trả `null` / lỗi, No Ads, thưởng chỉ đến từ SDK.
- Luôn: `hs-check` 0 ❌, kiểm kích thước gói, build web.

## 13. So sánh V1 → V2
| | V1 | V2 |
|---|---|---|
| Nguồn đồ ăn | 1 (siêu thị) | 4 (siêu thị, giao hàng, buffet, tự nấu) |
| Catalog | 36 món | 36 + 10 món chính + 6 phụ + ~30 phần buffet + 7 công thức |
| Quét mã | bắt buộc mỗi level | tự động; mini-game Checkout Rush ở 3 level |
| Tương tác đầu | ~10 s (siêu thị) | ≤ 3 s (vào stream luôn) |
| Cơ chế stream | kéo–giữ | + combo, perfect, cay, fan request/voting, mystery, duo |
| Streamer | khác ngoại hình | + năng lực riêng, Duo |
| Level | công thức | 30 level dữ liệu, 5 chương có tên |
| Nơi stream | 5 nền ngoài trời | nhà (cửa sổ đổi theo chương) + nhà hàng |
| Coin | dư, không có chỗ tiêu | lưới an toàn + trang trí phòng |

## 14. Thứ tự làm (sau khi duyệt)
1. **Phase 2 — 5 phút đầu**: `levels.js`, `catalog.js`, combo/cay/request/mystery; L1 vào stream luôn; Delivery, Buffet, DIY bản tối thiểu cho L2–L4 (fallback canvas); L1–6 chơi được; test.
2. **Phase 3**: L7–30, công thức DIY, năng lực, Duo, subpackage, cân nhịp.
3. **Phase 4**: ad place mới (không tracking).
4. **Phase 5**: QA, mô phỏng 30 level, kích thước gói, báo cáo.
5. Song song: `ART-REQUEST-V2.md` cho Codex.

## 15. Quyết định của chủ dự án (03/11/2026)
1. Bối cảnh "ở nhà" = phòng stream + cảnh cửa sổ đổi theo chương (tái dùng 5 nền) — **OK**.
2. Art mới gửi Codex theo `docs/ART-REQUEST-V2.md`; trong lúc chờ chạy hình canvas — **OK**.
3. Trang trí phòng (chỗ tiêu coin) — **để sau**.
4. L1 vào stream luôn với 3 món bày sẵn; coin khởi đầu 500 — **OK**.
5. Thời lượng: chấp nhận ~44′ và **tăng lên**, không cắt.
6. Bỏ KPI quảng cáo và tracking.

## 16. Báo cáo Phase 2 (03/11/2026)

**Đã làm**
- Dữ liệu: `src/catalog.js` (4 catalog: 36 món siêu thị, 10 món chính + 6 món phụ delivery, 5 trạm buffet × 6 + trạm dessert dùng lại art, 7 công thức DIY + 19 topping, 4 món mystery), `src/levels.js` (30 level dữ liệu: chương, nguồn, cơ chế, request, mystery, challenge, **vòng encore**, goal 800 → 1,5M).
- Cơ chế: `src/mech.js` — combo (khoảng cách 2,5 s, ×1,2/1,5/2/2,5), perfect bite (vòng miệng trong 44), thanh cay (ON FIRE ≥ 60, TOO HOT ở 100 → reset combo, không thua; đồ uống −35, lạnh −20, chua −15), fan request (10 s, +8 % goal, chỉ hỏi thứ có trên bàn), mystery (5 kết quả, pity), challenge, năng lực Luna/Kiko/Momo.
- 4 nguồn đồ ăn (`src/scenes.js` + `game.js`): siêu thị tự quét (kéo tay vẫn được), app YUMGO (tab nhà hàng, món chính + phụ, ORDER, xe giao 2,4 s – chạm để bỏ qua, hộp mở bằng chạm trong stream), buffet (gắp bằng kẹp kéo/chạm, đĩa N ô, thưởng đa dạng/đĩa cay, vé), bếp DIY (bộ nguyên liệu + topping, 5 loại thao tác: rub/tap/stir/hold/drop, thưởng "homemade").
- Stream: ở nhà (cửa sổ theo chương) hoặc nhà hàng; HUD mới (combo, nhiệt, yêu cầu, thử thách, vòng); **vòng encore** khi bàn trống (fan gửi thêm / mystery / món cay + nước / request rush) — kéo dài level sau bằng hoạt động mới.
- Economy: coin đầu 500, món trả ×1,4 chi phí (miễn phí: giá trị danh nghĩa 120 + 15n), tip ở 25/50/75/100/135 % goal, encore trả ×0,6; **Fan Gift miễn phí** khi thiếu coin; interstitial từ L7.
- Người mới vào thẳng stream L1; `run_json` v2 (mode, hộp đóng, vòng còn lại, combo/cay) và đọc được run V1.
- Test (`tools/sim-test.mjs`): 79 kiểm tra + mô phỏng 5 hồ sơ × 30 level qua input thật; thời gian người = thời gian game khi thao tác + chi phí suy nghĩ/chạm theo hồ sơ (không tính thời gian bot chạy). `hs-check` 0 ❌.

**Mô phỏng 30 level (thời gian người ước tính)**
```
persona think/tap costs) ──
persona          L3      L6     L12     L18     L24     L30   taps/drags  stars  min coins  end coins  fan gifts  interst.  rewarded
beginner      1'44"   4'31"  12'11"  22'39"  35'09"  52'02"          749     71        500      17756          0        23         0
average       1'22"   3'31"   9'43"  18'11"  28'21"  41'56"          786     73        500      18722          0        23         0
skilled       1'13"   2'59"   8'12"  15'15"  24'08"  35'34"          833     83        500      20963          0        23         0
adUser        2'58"   6'38"  15'54"  27'19"  40'26"  57'17"          816     78        500      28524          0        23        30
noAds         1'25"   3'34"   9'18"  17'05"  26'41"  40'04"          786     76        500      18578          0         0         0
average: seconds per level (incl. food source + result): 17 30 33 35 42 50 50 58 52 55 61 67 75 84 75 81 75 83 94 96 104 94 91 97 126 127 110 140 122 157
```
- Bot cho điểm trung bình **~42′** cho 30 level (beginner ~52′, skilled ~36′). Ad user: +30 s mỗi rewarded ad xem.
- Không blocker, không cần Fan Gift ở cả 5 hồ sơ; số dư không bao giờ dưới 500.
- **Coin dư ~18–21K cuối game** → cần chỗ tiêu (trang trí phòng — để sau theo quyết định 3).
- 5 phút đầu (average): L1 17 s → L6 ≈ 3′30″; 4 nguồn đồ ăn + mystery + 2 trạm buffet + combo/cay/request đã xuất hiện.

**Chưa làm (Phase 3)**: Duo Mukbang (L16+), fan voting (L13), multi-request cùng lúc, Checkout Rush, finale 3 nguồn (L30 hiện là delivery + mystery), nút đổi nguồn ở Home, subpackage `art2/` (khi có art), ad place mới (Phase 4). Thời lượng sẽ tăng thêm khi có các mục này.
