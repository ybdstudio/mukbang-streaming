# Mukbang Bang V4 — yêu cầu art cho Codex: Wardrobe + Nấu ăn + Popup tính năng

Ngày 04/11/2026. Gameplay: `docs/GAME-DESIGN-V4.md`. Phong cách, viền và màu giữ đúng `docs/ART-DIRECTION-V3.md` §1–2: premium kawaii 2D, viền nâu ấm `#4a3336` dày ≈3% cạnh hình, pastel, vẽ ở 2×, PNG nền trong suốt nén pngquant. Phải khớp bộ art Codex đã giao (streamer, món ăn, nền).

**Hiện trạng:** Wardrobe đã có trong ART-DIRECTION-V3 §6 nhưng mới là danh sách ngắn, và chưa có file nào trong `assets/wardrobe/`. Game đang vẽ tạm mọi item, mọi bước nấu và mọi dụng cụ bằng vector. File này thay §6 và bổ sung toàn bộ art nấu ăn của V4.

Tên file, kích thước và neo phải đúng như dưới đây: game ghép sprite theo các thông số này (`src/sprites.js`, `assets/manifest.json`). Giao kèm phần bổ sung cho `assets/manifest.json` (mục `wardrobe`, `cook`, `features`).

**Ngân sách:** gói chính TikTok ≤ 4 MB, hiện đang dùng 3,1 MB. Toàn bộ art trong file này nên ≤ 0,8 MB. Phần vượt quá đặt vào `assets/art4/` (subpackage).

---

## 1. Wardrobe — `assets/wardrobe/` (ưu tiên 1)

### 1.1 Cách ghép (đọc kỹ)

- Streamer có 2 lớp: `streamer/<id>_body.png` 512×420 (neo cổ `bodyAnchor` ≈ [256, 43]) và `streamer/<id>_head.png` 512×512. Animation nhai chỉ thay mắt và miệng, đầu không di chuyển.
- **Outfit** là lớp phủ lên body: vẽ trên **cùng canvas 512×420, cùng vị trí với `<id>_body.png`** của từng streamer, để đặt chồng lên là khớp. Tay đặt trên bàn phải lộ ra như body gốc; nếu áo che tay thì vẽ luôn tay.
- **Hair** (đồ trên đầu) và **Extras** (mặt, cổ) là lớp phủ lên head: vẽ trên **cùng canvas 512×512 với `<id>_head.png`** của từng streamer.
- Neo đầu của mỗi streamer (theo `assets/manifest.json`):

| streamer | headAnchor | eyes | mouth | neckOnHead | faceRadius |
|---|---|---|---|---|---|
| luna | [256, 350] | ≈ [256, 320] | [256, 408] | [256, 465] | 160 |
| kiko | [256, 350] | [256, 320] | [256, 408] | [256, 465] | 160 |
| momo | [256, 281] | [256, 260] | [256, 348] | [256, 386] | 160 |

- Phải vẽ **cho cả 3 streamer**, vì kiểu tóc khác nhau: búi to (Luna), tóc ngắn xù (Kiko), tóc dài thẳng (Momo). Phụ kiện tóc phải ôm theo kiểu tóc, không lơ lửng.
- Kính, sticker và tai nghe **không được che mắt hay miệng**, vì biểu cảm nhai và ngạc nhiên vẫn phải đọc được. Kính dùng tròng trong suốt khoảng 25%.
- Tên file: `wardrobe/<item_id>_<streamer>.png`, ví dụ `wardrobe/hair_bow_kiko.png`.
- Icon cho lưới Wardrobe: `wardrobe/icon_<item_id>.png` 128×128. Vẽ item đứng riêng, không có người, và tâm nằm giữa ô.

### 1.2 Danh sách item (id khớp `src/wardrobe.js`)

**OUTFITS** (512×420, lớp phủ body). Mỗi item cần 3 file (×3 streamer) và 1 icon.

| id | tên | cách nhận | mô tả |
|---|---|---|---|
| `outfit_mint` | Mint Sweater | 500 xu | len mint `#9fe3c9`, bóng `#5fbf9f`, cổ tròn, 1 tim trắng nhỏ ở ngực |
| `outfit_bib` | Mukbang Bib | 800 xu | yếm ăn trắng hồng `#fff3f7`, viền diềm, chữ "YUM" nhỏ, mặc đè lên áo gốc |
| `outfit_sunny` | Sunny Sweater | quà level 16 | len vàng `#ffd95e`, bóng `#e0b52a`, có hoạ tiết mặt trời nhỏ |
| `outfit_sakura` | Sakura Sweater | quà level 24 | len hồng `#ffb3c7`, bóng `#e8759a`, rải cánh hoa anh đào |
| `outfit_chef` | Chef Apron | quà level 27 | tạp dề đầu bếp trắng có túi, buộc nơ sau cổ, mặc đè lên áo gốc |
| `outfit_star` | Star Overalls | quà level 36 | quần yếm lavender `#cdb0ff`, cúc sao vàng, ngôi sao lớn ở yếm |

`outfit_default` (My Sweater) là áo gốc của body, không cần vẽ. Chỉ cần 1 icon áo len trơn.

**HAIR** (512×512, lớp phủ head). Mỗi item cần ×3 streamer và 1 icon.

| id | tên | cách nhận | mô tả |
|---|---|---|---|
| `hair_bow` | Big Bow | quà level 6 | nơ to hồng `#ff7fa8` trên đỉnh đầu, lệch phải |
| `hair_star` | Star Clip | 300 xu | kẹp sao vàng nhỏ ở mái, lệch trái |
| `hair_cat_ears` | Cat Ears | quà level 19 | băng đô tai mèo, trong tai màu hồng |
| `hair_beret` | Red Beret | 900 xu | mũ nồi đỏ `#e8403a` đội nghiêng, có núm nhỏ |
| `hair_flowers` | Flower Crown | quà level 29 | vòng hoa nhỏ (hồng, vàng, trắng) kèm lá |
| `hair_bunny_ears` | Bunny Ears | quà level 34 | băng đô tai thỏ trắng dựng, 1 tai gập |
| `hair_crown` | Star Crown | quà level 40, item cuối | vương miện vàng `#ffd23f` 3 đỉnh, đỉnh giữa là ngôi sao, có lấp lánh |

**EXTRAS** (512×512, lớp phủ mặt hoặc cổ). Mỗi item cần ×3 streamer và 1 icon.

| id | tên | cách nhận | mô tả | neo |
|---|---|---|---|---|
| `acc_blush` | Heart Stickers | 400 xu | 2 sticker tim hồng trên má | dưới `eyes`, 2 bên |
| `acc_glasses_round` | Round Glasses | quà level 13 | kính tròn gọng nâu, tròng trong | `eyes` |
| `acc_headphones` | Headphones | quà level 22 | tai nghe chụp tai pastel, vòng qua đỉnh đầu | 2 bên đầu |
| `acc_heart_glasses` | Heart Glasses | quà level 31 | kính tim hồng, tròng hồng nhạt trong | `eyes` |
| `acc_scarf` | Cozy Scarf | quà level 38 | khăn len kẻ sọc quấn cổ, có đuôi khăn | `neckOnHead` |

### 1.3 Bộ phối (themed looks) — kiểm tra khi mặc đủ bộ

- **CHEF LOOK** = `outfit_chef` + (không phụ kiện tóc) + `acc_glasses_round`
- **KITTY LOOK** = `outfit_sakura` + `hair_cat_ears` + `acc_blush`
- **SUPERSTAR** = `outfit_star` + `hair_crown` + `acc_heart_glasses`

Mỗi bộ phải có màu hài hoà trên cả 3 streamer. Giao kèm 1 ảnh xem trước 3×3 (3 streamer × 3 bộ) để duyệt.

### 1.4 UI Wardrobe

- `wardrobe/tab_outfit.png`, `tab_hair.png`, `tab_extras.png`: icon tab 96×96.
- `wardrobe/badge_ad.png` 96×40: nhãn "▶" nền xanh `#6fc3ef`, dùng cho "▶ UNLOCK" (mở sớm bằng quảng cáo).
- `wardrobe/badge_gift.png` 96×40: hộp quà nhỏ kèm khoá, dùng cho "GIFT · LV n".
- Số lượng: 18 item × 3 streamer = 54 lớp phủ, cộng 19 icon item (gồm áo len trơn) và 5 UI.

---

## 2. Nấu ăn — `assets/cook/` (ưu tiên 2)

Màn bếp gồm hàng chấm tiến độ ở trên, món ăn ở giữa (khoảng 300 px logic, tức 600 px khi vẽ 2×), khay 4–5 ô chọn ở dưới, và nút ✓ xanh. Xem `src/cook.js`.

### 2.1 Nền và UI bếp

- `cook/bg_kitchen.jpg` 1080×2340: tường gạch pastel, kệ có hũ ở trên, mặt bàn gỗ sáng ở dưới 40%. Nền dịu để món ăn nổi.
- `cook/tray.png`: khay chọn dạng 9-slice, trắng mờ, bo tròn.
- `cook/card.png`, `card_selected.png` (viền xanh), `card_rare.png` (viền vàng kèm sao): ô chọn 9-slice 220×224.
- `cook/badge_rare.png` 160×52: nhãn "▶ RARE" nền xanh.
- `cook/ok.png` 136×136: nút ✓ xanh tròn.
- `cook/pip_on.png`, `pip_off.png` 40×40: chấm tiến độ (bật là tim hồng).
- `cook/banner_perfect.png`, `banner_yummy.png`: banner chữ 680×176 (có chữ PERFECT! và YUMMY!).
- `cook/request_card.png`: thẻ "VIEWER WANTS" 9-slice.

### 2.2 Đồ chứa và các trạng thái món (vẽ 600×600, tâm ở giữa)

Phần chất lỏng hoặc thạch vẽ **xám trắng** (lớp riêng `_fill`) để game tô màu theo vị. Lớp chi tiết (bóng, viền, highlight) vẽ riêng để giữ nguyên khi tô.

| recipe | file |
|---|---|
| jelly, pudding | `mold_<id>.png` cho 6 khuôn (dome, star, heart, flower, bunny, crown) · `jelly_<mold>_fill.png` (thạch trong khuôn) · `jelly_<mold>_out_fill.png` (thạch đã lật ra đĩa, rung rinh) · `plate_dessert.png` |
| cupcake | `cup_cupcake_<cup>.png` cho 5 cup (pink, mint, lavender, lemon, sky) · `cupcake_base.png` (bánh đã nướng) · `cupcake_cream_fill.png` |
| boba | `cup_boba_<cup>.png` (ly nhựa kèm nắp và ống hút) · `boba_fill.png` |
| ramen | `bowl_ramen_<cup>.png` · `ramen_broth_fill.png` · `ramen_noodles.png` |
| parfait | `glass_parfait.png` · `parfait_layer_fill.png` |
| donut | `donut_<shape>.png` cho 4 hình (ring, heart, star, bear) · `donut_glaze_<shape>_fill.png` |
| bingsu | `bowl_bingsu_<cup>.png` · `bingsu_snow.png` (núi đá bào) · `bingsu_syrup_fill.png` |

### 2.3 Lựa chọn trong khay: `cook/opt_<slot>_<id>.png` 160×160

Cần một icon cho mỗi lựa chọn dưới đây (id khớp `src/recipes.js`):

- **mold** (khuôn): dome, star, heart, flower, bunny, crown
- **flavor** (chai hoặc lọ siro, màu theo vị): strawberry, mango, matcha, grape, blueberry, peach, chocolate, milk, sakura, lemon, soda
- **broth** (bình nước dùng): shoyu, miso, spicy, creamy, curry
- **topping** (tráng miệng): cherry, strawberry_t, blueberry_t, mint, cream, kiwi, peach_t, mochi, choco_stick, sakura_t, gold_star
- **ramen_top**: egg (trứng lòng đào), chashu, scallion, naruto, corn, nori
- **boba_top**: pearls, jelly_cubes, pudding_t, red_bean, popping
- **deco** (lọ rắc): sprinkles, hearts, stars, pearls_d, snow, gold, cocoa
- **cup** (màu ly hoặc bát): pink, mint_c, lavender, lemon_c, sky
- **shape** (khuôn donut): ring, heart_d, star_d, bear

Topping và deco cần thêm sprite nhỏ khi đã đặt lên món: `cook/top_<id>.png` 96×96 (một miếng) và `cook/deco_<id>.png` 256×256 (một lớp rắc rải đều). Tổng cộng 70 icon lựa chọn và khoảng 40 sprite đặt lên món.

### 2.4 Dụng cụ: `cook/tool_<id>.png` 240×240, mỗi dụng cụ 2 frame `_0` (nghỉ) và `_1` (đang chạy)

`fan` (quạt cầm tay có cánh chuyển động mờ), `fire` (bếp ga nhỏ có lửa), `oven` (lò nướng mini, cửa phát sáng cam), `mixer` (máy đánh trứng cầm tay), `shaker` (bình lắc trà sữa), `shaver` (máy bào đá kiểu Hàn), `bottle_pour` (bình rót nghiêng có miệng rót, lớp nhãn `_fill` để tô màu).

Thêm hiệu ứng: `cook/fx_steam.png`, `fx_cold.png` (bông tuyết), `fx_pour.png` (dòng chảy tô được màu), `fx_sparkle.png`. Mỗi file là atlas 4 frame 128 px.

### 2.5 Đĩa phục vụ trên stream

`cook/plate_<recipe>.png` 300×300: đĩa hoặc khay để 1 phần món cho mỗi recipe (thạch dùng đĩa nhỏ, ramen dùng bát nhỏ, boba dùng ly nhỏ…). Thêm frame `_1`, `_2` cho trạng thái ăn dở (sau miếng cắn 1 và 2).

---

## 3. Popup tính năng mới — `assets/features/` (ưu tiên 3)

Popup "COMING SOON" (báo trước 2 stream) và "NEW FEATURE!" (có nút GO NOW / LATER) cần icon 256×256, nhìn được cả ở dạng khoá:

| file | tính năng | mô tả |
|---|---|---|
| `features/market.png` | SUPERMARKET (level 3) | xe đẩy siêu thị đầy snack |
| `features/delivery.png` | DELIVERY (level 7) | túi giao hàng YUMGO kèm xe máy nhỏ |
| `features/buffet.png` | BUFFET (level 11) | bàn buffet có lồng bàn bạc |
| `features/wardrobe.png` | WARDROBE (level 6) | tủ quần áo mở cửa, có nơ và mũ |
| `features/lock.png` | — | ổ khoá vàng nhỏ 96×96, chồng lên icon khi COMING SOON |

Streamer mới (Kiko ở level 10, Momo ở level 20) dùng art streamer đã có, không cần vẽ thêm.

---

## 4. Thứ tự giao

0. **Bảng mẫu để duyệt:** 3 streamer, mỗi người mặc 1 outfit + 1 hair + 1 extra; 1 khuôn thạch qua 3 trạng thái; 4 icon lựa chọn; 1 dụng cụ. Chờ chủ dự án duyệt rồi mới làm tiếp.
1. Wardrobe đầy đủ (§1).
2. Nấu ăn: jelly, pudding, ramen trước (dùng nhiều nhất), sau đó các recipe còn lại (§2).
3. Popup tính năng (§3).

Khi nhận file, Claude sẽ tích hợp: nạp sprite theo manifest, giữ vector làm fallback, rồi kiểm tra bằng `tools/sim-test.mjs` (đường dẫn sprite không được thiếu file).
