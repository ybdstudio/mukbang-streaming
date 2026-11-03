# Mukbang Bang V3 — art direction & asset specification

Ngày 03/11/2026. Dành cho Codex (hoặc artist). **Làm lại toàn bộ hình ảnh** — giữ ý tưởng game, không giữ ngoại hình cũ. Gameplay: `docs/GAME-DESIGN-V3.md`.
Game đang chạy bằng art V1 + hình canvas tạm; art V3 thay thế qua cùng hệ thống sprite (`src/sprites.js`) — **mỗi file phải đúng tên / kích thước / neo dưới đây**. Không giao hình nào trước khi chủ dự án duyệt **bảng mẫu (§8 đợt 0)**.

---

## 1. Hướng nghệ thuật

**Premium kawaii 2D casual** — như một game mobile top-grossing dễ thương, không phải sticker phẳng.
- **Nhân vật chibi** đầu ~55 % chiều cao, **mặt to**, mắt lớn có 2 điểm sáng, miệng đọc được ở kích thước nhỏ (64 px) — biểu cảm phải hiểu ngay ở thumbnail.
- **Silhouette rõ**: mỗi streamer nhận ra được chỉ bằng bóng đen (kiểu tóc + phụ kiện đặc trưng khác hẳn nhau).
- **Viền** tròn, cùng độ dày (≈ 3 % cạnh hình), màu nâu ấm `#4a3336` (không đen); bên trong viền mảnh hơn cho chi tiết.
- **Màu**: pastel tươi nhưng cân bằng — 1 màu chủ đạo bão hoà vừa cho mỗi vật, bóng mềm 1 tông, 1 highlight trắng; nền **dịu hơn** nhân vật & món ăn (độ bão hoà nền ≤ 60 % của foreground) để mặt và món luôn nổi.
- **Món ăn** "ngon thật": kết cấu rõ (giòn, mềm, bóng, sủi bọt), hơi nước / độ bóng / vụn — vẫn trong phong cách kawaii (mặt cười nhỏ trên bao bì là được, không bắt buộc).
- **Ít rối**: mỗi màn 1 trọng tâm; HUD gọn, bo tròn; không chữ trong art trừ nhãn bao bì ngắn và logo.
- **Không** sao chép bất kỳ game/thương hiệu thật nào (kể cả "Mukbang ASMR Livestream Party" trong `_ref/`, KFC, Pocky, Baemin…). Tên nhà hàng, app (YUMGO) là hư cấu.

## 2. Kỹ thuật chung
- Toạ độ logic rộng 540, màn dọc 9:16 → 9:19,5. **Vẽ 2×** (sprite PNG nền trong suốt, nén pngquant; nền JPG q80 ≤ 180 KB).
- Gói chính TikTok ≤ 4 MB (hiện 3,1 MB với art V1). Art V3 **thay** art V1 (xoá file cũ) — mục tiêu art V3 trong gói chính ≤ 3,3 MB; phần vượt vào subpackage `art3/` (Claude khai báo `game.json` khi tích hợp).
- Mọi hình kèm `assets/manifest.json` (định dạng như V1: kích thước, neo, atlas rect).

## 3. Streamer (3 nhân vật mới) — `assets/streamer/`
Thiết kế **mới hoàn toàn** (không tô lại Luna/Kiko/Momo cũ), giữ tên + vai trò:
| Id | Tên | Tính cách | Màu chủ đạo | Đặc điểm silhouette |
|---|---|---|---|---|
| `luna` | Luna | ngọt ngào, hay ngạc nhiên | lavender + mint | 2 búi tóc lớn, mái bằng |
| `kiko` | Kiko | năng động, thích đồ ngọt | cam + vàng | tóc ngắn xù, 1 lọn dựng |
| `momo` | Momo | điềm tĩnh, mê đồ lạnh | navy + hồng | tóc dài thẳng chấm vai, mái chéo |

Mỗi streamer giao **lớp tách rời** (giống V1, để Wardrobe & biểu cảm ghép được):
- `<id>_body.png` 512×420 — thân **mặc áo cơ bản trơn** (không in hoạ tiết lớn ở ngực để outfit overlay đè lên được), 2 tay đặt trên bàn. Neo `bodyAnchor` = điểm cổ.
- `<id>_head.png` 512×512 — đầu + tóc, **mặt trống** (không mắt/miệng, có má hồng). Neo `headAnchor` = tâm mặt; ghi `faceRadius`, `eyes`, `mouth`, `neckOnHead`, và **`hairTop`** (đỉnh tóc, cho phụ kiện tóc), **`earL`/`earR`** (cho tai nghe).
- `<id>_hair_back.png` (tuỳ chọn) — phần tóc sau đầu nếu cần để phụ kiện nằm giữa 2 lớp tóc.

**Biểu cảm** — atlas `streamer/face_parts.png` (dùng chung, ô 240×120), mỗi bộ phận vẽ để đặt vào `eyes`/`mouth` của bất kỳ streamer nào:
| Trạng thái game | Mắt | Miệng | Ghi chú |
|---|---|---|---|
| idle | `eyes_open` (+ `eyes_blink`) | `mouth_smile` | |
| open (portion tới gần) | `eyes_sparkle` | `mouth_open_wide` | chờ ăn, háo hức |
| chew A / B | `eyes_happy` | `mouth_chew_a`, `mouth_chew_b` | 2 frame xen kẽ khi nhai, má phồng |
| sweet | `eyes_heart` | `mouth_cat` (ω) | |
| spicy | `eyes_x` | `mouth_fire` (lè lưỡi + lửa nhỏ) | + fx mồ hôi |
| cold | `eyes_squeeze` | `mouth_shiver` (răng run) | + fx đá |
| sour | `eyes_wink_squeeze` | `mouth_pucker` | |
| fizzy | `eyes_wide` | `mouth_o` | + fx bọt |
| yum / first taste | `eyes_closed_bliss` | `mouth_yum` (cười tươi, lưỡi liếm) | |
| **viral finale** | `eyes_star` | `mouth_laugh` | + fx sao/tim — trạng thái "đỉnh" của mỗi stream |
FX (atlas `streamer/face_fx.png`, ô 240×120): `fx_sweat`, `fx_frost`, `fx_bubbles`, `fx_hearts`, `fx_stars`, `fx_steam_ears`.

## 4. Món ăn & bao bì — 50 món (`assets/food3/`)
Mỗi stream = 1 món, hiển thị lớn (≈ 250 logic = 500 px). Mỗi món giao **6 trạng thái** + 1 portion:
| File | Nội dung |
|---|---|
| `<id>_sealed.png` | gói / hộp / nắp chuông **đóng kín** |
| `<id>_open.png` | vừa mở, **đầy** (3 phần ăn thấy rõ) |
| `<id>_p1.png` | sau lần gắp 1 (còn 2/3) |
| `<id>_p2.png` | sau lần gắp 2 (còn 1/3) |
| `<id>_empty.png` | **rỗng**: vỏ/hộp/bát trống + vụn |
| `<id>_portion.png` | 1 phần ăn **trên đũa / dĩa / thìa** hoặc 1 ngụm (đồ uống) — thứ bay tới miệng |
| `<id>_open_fx.png` (theo **kiểu bao bì**, dùng chung) | xem §4.1 |
Kích thước 512×512, món căn giữa, neo [256, 256], đáy món ở ~80 % chiều cao (đứng trên bàn).
Màu vụn khi cắn lấy từ `c1/c3` trong `src/catalog.js` → giữ màu chính của món gần với bảng đó (hoặc ghi màu mới vào manifest).

### 4.1 Animation mở theo kiểu bao bì (atlas dùng chung, `assets/food3/open_<kind>.png`, 4 frame ngang 512×512)
| kind | Frame | Âm |
|---|---|---|
| `bag` | dải xé trên cùng → rách → bay ra | crunch |
| `cup` | nắp giấy bóc dần → cuộn lại | slurp |
| `bottle` | nắp bật → bọt phun | fizz |
| `box` | nắp hộp giấy mở → hơi nóng | pop |
| `dome` | nắp chuông bạc nhấc lên → lấp lánh | ding |
(Frame chồng lên `<id>_sealed` → `<id>_open`; game nội suy alpha.)

### 4.2 Danh sách 50 món (theo thứ tự stream)
| # | id | Món | Bao bì | Vị | Art hiện có |
|---|---|---|---|---|---|
| 1 | `cat_chips` | Cat Chips | bag | savory | V1 có (vẽ lại) |
| 2 | `honey_puffs` | Honey Puffs | bag | sweet | V1 có (vẽ lại) |
| 3 | `cheese_noodle` | Cheese Noodle | cup | savory | V1 có (vẽ lại) |
| 4 | `soda_pop` | Soda Pop | bottle | fizzy | V1 có (vẽ lại) |
| 5 | `straw_cake` | Strawberry Cake | dome | sweet | V1 có (vẽ lại) |
| 6 | `rainbow_candy` | Rainbow Candy | bag | sweet | V1 có (vẽ lại) |
| 7 | `peach_milk` | Peach Milk | bottle | sweet | V1 có (vẽ lại) |
| 8 | `chili_noodle` | Chili Noodle | cup | spicy | V1 có (vẽ lại) |
| 9 | `mint_choc` | Mint Choc | cup | cold | V1 có (vẽ lại) |
| 10 | `kfc_chicken` | Korean Fried Chicken | box | savory | mới |
| 11 | `matcha_roll` | Matcha Roll | dome | sweet | V1 có (vẽ lại) |
| 12 | `gummy_bears` | Gummy Bears | bag | sour | V1 có (vẽ lại) |
| 13 | `bubble_tea` | Bubble Tea | bottle | sweet | V1 có (vẽ lại) |
| 14 | `seaweed_crisps` | Seaweed Crisps | bag | savory | V1 có (vẽ lại) |
| 15 | `banana_milk` | Banana Milk | bottle | sweet | V1 có (vẽ lại) |
| 16 | `pizza` | Pepperoni Pizza | box | savory | mới |
| 17 | `melon_bowl` | Melon Jelly Bowl | dome | sweet | V1 có (vẽ lại) |
| 18 | `choco_pretzel` | Choco Pretzels | bag | sweet | V1 có (vẽ lại) |
| 19 | `tteokbokki` | Tteokbokki | box | spicy | mới |
| 20 | `blue_moon` | Blue Moon | cup | cold | V1 có (vẽ lại) |
| 21 | `mango_cheese` | Mango Cheesecake | dome | sour | V1 có (vẽ lại) |
| 22 | `berry_smoothie` | Berry Smoothie | bottle | sour | V1 có (vẽ lại) |
| 23 | `sushi_set` | Sushi Set | box | cold | mới |
| 24 | `sakura_noodle` | Sakura Noodle | cup | sweet | V1 có (vẽ lại) |
| 25 | `sea_noodle` | Seafood Noodle | cup | savory | V1 có (vẽ lại) |
| 26 | `choco_mousse` | Choco Mousse | dome | sweet | V1 có (vẽ lại) |
| 27 | `cheese_burger` | Cheese Burger | box | savory | mới |
| 28 | `straw_swirl` | Strawberry Swirl | cup | cold | V1 có (vẽ lại) |
| 29 | `dumplings` | Dumplings | box | savory | mới |
| 30 | `rainbow_crepe` | Rainbow Crepe | dome | sweet | V1 có (vẽ lại) |
| 31 | `mini_hotpot` | Mini Hotpot | box | spicy | mới |
| 32 | `cookie_cream` | Cookie Cream | cup | cold | V1 có (vẽ lại) |
| 33 | `bean_noodle` | Black Bean Noodle | cup | savory | V1 có (vẽ lại) |
| 34 | `grape_bunch` | Grape Bunch | dome | sour | V1 có (vẽ lại) |
| 35 | `curry_rice` | Curry Rice | box | spicy | mới |
| 36 | `mango_sorbet` | Mango Sorbet | cup | cold | V1 có (vẽ lại) |
| 37 | `seafood_boil` | Seafood Boil | box | spicy | mới |
| 38 | `berry_tart` | Berry Tart | dome | sour | V1 có (vẽ lại) |
| 39 | `choco_sundae` | Choco Sundae | cup | cold | V1 có (vẽ lại) |
| 40 | `golden_parfait` | Golden Parfait | dome | sweet | mới |
| 41 | `shroom_noodle` | Mushroom Noodle | cup | savory | V1 có (vẽ lại) |
| 42 | `matcha_latte` | Matcha Latte | bottle | savory | V1 có (vẽ lại) |
| 43 | `spicy_wings` | Spicy Wings | dome | spicy | mới |
| 44 | `mango_cubes` | Mango Cubes | dome | sweet | V1 có (vẽ lại) |
| 45 | `pasta` | Creamy Pasta | box | savory | mới |
| 46 | `choco_ramen` | Chocolate Ramen | dome | sweet | mới |
| 47 | `straw_plate` | Strawberry Plate | dome | sour | V1 có (vẽ lại) |
| 48 | `mochi` | Mochi | box | sweet | mới |
| 49 | `pickle_icecream` | Pickle Ice Cream | dome | sour | mới |
| 50 | `berry_mix` | Berry Mix | dome | sweet | V1 có (vẽ lại) |

## 5. Màn hình & UI
| Hạng mục | File | Mô tả |
|---|---|---|
| Phòng stream (nhà) | `bg/home_room.png` 1080×2400 | phòng streamer ấm cúng, **cửa sổ trong suốt** ở 16–84 % ngang × 7–38 % dọc (game ghép 5 cảnh chương phía sau), đèn ring light, kệ thú bông; vùng dưới 48 % đơn giản (bàn phủ) |
| Cảnh ngoài cửa sổ ×5 | `bg/view_park.jpg` … `view_city.jpg` | vẽ lại 5 nền V1 cùng bố cục (park, beach, sakura, night room, neon city) |
| Nhà hàng buffet | `bg/restaurant.jpg` | đèn lồng, quầy buffet mờ |
| Bàn stream | `ui/table_<chapter>.png` 1080×1100 | khăn bàn theo chương (6), viền cong |
| Home | `ui/logo_v3.png` 900×420, `ui/btn_*.png` (9-slice) | logo MUKBANG BANG mới; nút lớn START MUKBANG nổi bật nhất; 4 icon hoạt động (giỏ, xe giao, khay buffet, chảo) 128×128 |
| HUD livestream | `ui/live_pill.png`, `ui/goal_bar.png`, `ui/pip_on/off.png`, `ui/heart_float.png` | LIVE + viewers dễ đọc; 3 chấm tiến độ gắp; tim bay tap được (to, rõ, ≥ 56 px) |
| Banner nhịp | `ui/banner_first.png`, `banner_wild.png`, `banner_last.png`, `banner_viral.png` 900×260 | khung chữ FIRST TASTE! / FANS GOING WILD! / LAST BITE! / VIRAL! (chữ do game vẽ, khung do art) |
| Sự kiện fan | `ui/gift_box.png`, `ui/superchat_frame.png`, `ui/duet_frame.png`, `ui/trending.png` | |
| Kết quả | `ui/result_panel.png` (9-slice), `ui/star_on/off.png`, `ui/coin.png`, `ui/food_book.png` | |
| Icon | atlas `ui/icons_v3.png` 96 px | coin, sao, tim, khoá, mắt, +, cài đặt, wardrobe, levels, âm thanh |
| Hiệu ứng | atlas `ui/fx_v3.png` 128 px | lấp lánh, confetti, vụn, hơi nóng, bọt, đá, lửa |
| Avatar chat ×7, emoji ×7 | atlas như V1 | vẽ lại cùng phong cách mới |

## 6. Wardrobe — `assets/wardrobe/`
Mỗi item là **lớp PNG riêng** đặt theo neo của streamer (game đặt bằng `headAnchor/faceRadius/hairTop/eyes/neckOnHead` → không phá animation nhai, vì chỉ bộ phận mắt/miệng thay đổi):
| Slot | Item id (khớp `src/wardrobe.js`) | Kiểu lớp | Neo |
|---|---|---|---|
| outfit | `outfit_mint`, `outfit_bib`, `outfit_sunny`, `outfit_sakura`, `outfit_chef`, `outfit_star` | thay **body** (512×420, cùng dáng body cơ bản) | `bodyAnchor` |
| hair | `hair_bow`, `hair_star`, `hair_cat_ears`, `hair_beret`, `hair_flowers`, `hair_bunny_ears`, `hair_crown` | lớp trên đầu 512×512 | `hairTop` |
| extras | `acc_blush`, `acc_glasses_round`, `acc_headphones`, `acc_heart_glasses`, `acc_scarf` | lớp mặt/cổ 512×512 | `eyes` / `earL,earR` / `neckOnHead` |
- Mỗi item thêm **icon 128×128** cho lưới Wardrobe (`wardrobe/icon_<id>.png`).
- Outfit phải vẽ cho **cả 3 dáng body** nếu body khác nhau (hoặc thiết kế 3 body cùng dáng để dùng chung — ưu tiên).
- 3 themed look (CHEF, KITTY, SUPERSTAR) phải trông đồng bộ khi mặc đủ bộ.

## 7. Âm thanh (ngoài phạm vi art — ghi để đồng bộ)
Game đang tổng hợp âm PCM (crunch, slurp, gulp, soft, lick, bite, fizz, fire, shiver, sour, sweet…). Nếu có sound designer: mỗi kiểu mở gói 1 âm, mỗi nhóm món 3 biến thể cắn, 1 jingle VIRAL.

## 8. Thứ tự giao
0. **Bảng mẫu (duyệt trước)**: 3 streamer (head/body, 4 biểu cảm: idle, chew, yum, viral) + 2 món đầy đủ 6 trạng thái + portion (`cat_chips` bag, `cheese_noodle` cup) + 1 khung HUD livestream + home_room. **Dừng chờ duyệt.**
1. Streamer đầy đủ (12 biểu cảm, fx) + 10 món stream 1–10 + animation mở 5 kiểu + HUD + home + kết quả.
2. Món 11–30 + Wardrobe (outfit, hair, extras, icon).
3. Món 31–50 + cảnh cửa sổ ×5 + nhà hàng + icon/fx/avatar/emoji còn lại + manifest hoàn chỉnh + báo cáo dung lượng.
Tiêu chí duyệt mỗi đợt: đọc được ở 64 px, silhouette 3 streamer khác biệt, đúng tên/kích thước/neo, không thương hiệu thật, dung lượng trong ngân sách.
