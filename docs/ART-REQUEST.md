# Mukbang Bang — yêu cầu art (brief cho Codex)

Ngày 03/11/2026. Đọc kèm `docs/PROGRESS.md`. Hiện **toàn bộ hình trong game được vẽ bằng code canvas** (`mukbang-bang/src/art.js`). File này liệt kê mọi hình cần thay bằng sprite, kèm kích thước, tên file, điểm neo, trạng thái và ngân sách dung lượng.

---

## 0. Việc của Codex

1. Tạo bộ asset theo danh sách ở mục 4 → lưu vào `mukbang-bang/assets/` đúng tên file.
2. Ghi `mukbang-bang/assets/manifest.json` (mục 5) với kích thước thật + điểm neo của từng file.
3. Kiểm tra ngân sách dung lượng (mục 2) và tự nén.
4. **Chỉ khi được giao thêm**: tích hợp vào code theo mục 6. Mặc định chỉ làm art, không sửa code.

## 1. Phong cách (bắt buộc)

- **Kawaii / chibi 2D**, nét viền dày bo tròn, màu pastel sáng, tô phẳng + 1 lớp bóng mềm + 1 điểm highlight trắng. Giống sticker.
- Màu viền chung: **`#5b3d3b`** (nâu đậm, không dùng đen). Độ dày viền ≈ 3–4 % cạnh sprite.
- Bảng màu gốc: `COLORS` trong `src/data.js` (pink `#ff9fc4`, mint `#9fe3c9`, yellow `#ffd95e`, blue `#8fd1ff`, lavender `#cdb0ff`, gold `#ffc83d`, cream `#fff8ef`). Mỗi món ăn đã có `c1/c2/c3` trong `FOODS` → dùng làm màu chủ đạo.
- Góc nhìn: món ăn **chính diện hơi chếch từ trên (~15°)**; nhân vật chính diện.
- **Không chữ** trong hình, trừ nhãn ngắn trên bao bì món (cột `label` trong `FOODS`, ví dụ `CHILI`, `BOBA`) và logo.
- **KHÔNG sao chép** hình, nhân vật, logo, bao bì của game thương mại trong `_ref/` ("Mukbang ASMR Livestream Party") hay bất kỳ thương hiệu thật nào. `_ref/` chỉ để hiểu bố cục màn chơi. Mọi thiết kế phải là bản gốc.
- Ảnh nền trong suốt (PNG alpha) cho mọi sprite, trừ ảnh nền màn chơi.

## 2. Kỹ thuật & ngân sách

- Toạ độ logic của game: **rộng 540**, cao 960–1170 tuỳ máy (dọc). Hình được scale theo `devicePixelRatio`, nên **vẽ ở 2× logic**. Kích thước dưới đây đã là 2×.
- Định dạng: **PNG-8/PNG-24 đã nén** (pngquant/oxipng) cho sprite; **JPG q≈80** cho ảnh nền. Không dùng WebP (runtime TikTok/Android không chắc hỗ trợ).
- Giới hạn TikTok: **gói chính ≤ 4 MB**, tổng ≤ 30 MB (phần vượt phải vào `game.json` → `subpackages`). Code hiện ~350 KB.
  - **Mục tiêu: toàn bộ art ≤ 3.2 MB** để vẫn nằm trong gói chính. Nếu vượt, báo lại; đừng tự tạo subpackage.
  - Bản web (`tools/build-web.mjs`) sẽ nhúng base64 vào 1 file HTML (+33 %), giới hạn artifact 16 MB → vẫn ổn nếu ≤ 3.2 MB.
- Gợi ý chia ngân sách: món ăn ~1.4 MB, streamer ~0.6 MB, nền ~0.9 MB, còn lại ~0.3 MB.
- Ưu tiên **atlas** (sprite sheet) cho nhóm nhỏ: emoji, avatar, mặt. Ghi toạ độ từng ô vào manifest.

## 3. Danh sách tổng (số file)

| Nhóm | Số hình | Ưu tiên |
|---|---|---|
| A. Món ăn: 36 món × trạng thái ăn dở | 120 frame | P0 |
| B. Streamer: 3 nhân vật (thân + đầu) + bộ mặt dùng chung | 6 + ~20 bộ phận | P0 |
| C. Nền livestream: 5 bối cảnh | 5 (+ lớp động tuỳ chọn) | P0 |
| D. Siêu thị & quầy quét: nền cửa hàng, kệ, giỏ, máy quét, băng chuyền, gấu thu ngân | 7 | P1 |
| E. HUD / icon: coin, sao, tim, khoá, mắt, điện thoại gậy selfie, 7 emoji, 7 avatar chat | ~20 (2 atlas) | P1 |
| F. Logo "MUKBANG BANG" + icon app 512 | 2 | P1 |

Nút bấm, panel, chữ, thanh LIVE, khăn bàn caro, confetti **giữ vẽ bằng code**: không cần art.

---

## 4. Chi tiết từng nhóm

### A. Món ăn — `assets/food/<id>_<stage>.png`

- Canvas **256×256**, món căn giữa, chừa lề ~8 %. Điểm neo = tâm ảnh (game vẽ món căn giữa trong ô 100 đơn vị; kích thước hiển thị 60–136 logic).
- `stage` = số miếng đã ăn: `0` = nguyên, `1`…`bites-1` = ăn dở dần. Sau miếng cuối món biến mất nên **không cần frame rỗng**.
  - noodles, cakes: 4 miếng → stage 0,1,2,3
  - snacks, drinks, icecream, fruit: 3 miếng → stage 0,1,2
  - Tổng: 6×4 + 6×4 + 24×3 = **120 frame**.
- Cách thể hiện ăn dở (như code hiện tại):
  - **noodles** (ly mì có nắp/đai màu, chopsticks): núi mì giảm dần, nắp mở, hơi nóng. Đai có 2 tai thú nhỏ.
  - **snacks** (túi snack phồng, cửa sổ trong thấy bánh, mascot mặt cười nhỏ): stage ≥1 túi xé miệng, bánh trong cửa sổ vơi dần.
  - **drinks** (`v` 0–1 hộp sữa, 2 ly latte, 3 lon/chai soda, 4 ly trà sữa trân châu + ống hút to, 5 ly smoothie): mực nước hạ dần.
  - **cakes** (miếng bánh trên đĩa trắng): miếng bánh hẹp dần, có vết cắn.
  - **icecream** (ly/ốc quế, có topping): viên kem nhỏ dần.
  - **fruit** (bát/đĩa): số miếng trái cây giảm dần.
- 36 món (id → tên → vị → màu c1/c2/c3) lấy **chính xác** từ `FOODS` trong `mukbang-bang/src/data.js`. Không đổi id.
- Mỗi kệ phải phân biệt rõ 6 món bằng màu + hình (cùng dáng bao bì trong 1 kệ là được, như siêu thị thật).
- Món vị **spicy** nên có chi tiết ớt/lửa nhỏ; **cold** có hơi lạnh/tinh thể; **fizzy** có bọt.

### B. Streamer — `assets/streamer/`

Dùng **ghép lớp** để các biểu cảm luôn khớp nhau:

1. `<id>_body.png`: thân + tay (áo màu `top`/`topDark`), **512×420**, neo = điểm cổ (giữa mép trên).
2. `<id>_head.png`: đầu + tóc + phụ kiện, **mặt trống** (không mắt, không miệng, có má hồng), **512×512**, neo = tâm mặt. Bán kính mặt ≈ 190 px (= 95 logic × 2).
3. `face_parts.png` (atlas dùng chung cho cả 3 nhân vật, mắt màu nâu tím đậm): đặt lên đầu theo toạ độ trong manifest.
   - Mắt (cặp): `eyes_open`, `eyes_blink`, `eyes_happy` (^ ^), `eyes_x` (> <, cay), `eyes_squiggle` (lạnh run), `eyes_heart` (ngọt), `eyes_wide` (sốc soda), `eyes_squint` (chua)
   - Miệng: `mouth_idle` (cười nhẹ), `mouth_open` (há to chờ ăn), `mouth_chew_a`, `mouth_chew_b` (2 frame nhai), `mouth_yum` (cười tươi há), `mouth_spicy` (thè lưỡi + lửa), `mouth_cold` (răng run zigzag), `mouth_sweet`, `mouth_fizzy` (chữ o), `mouth_sour` (chúm)
   - Hiệu ứng phủ (tuỳ chọn): `fx_sweat` (cay), `fx_frost` (lạnh), `fx_sparkle` (soda).

Bảng biểu cảm trong game (`setFace`): idle, open, chew, yum, spicy, cold, sweet, fizzy, sour.

| id | Tên | Mở | Tóc | Kiểu | Phụ kiện | Áo |
|---|---|---|---|---|---|---|
| luna | Luna | L1 | `#cdb0ff` tím lavender | 2 búi tròn | nơ hồng `#ff7fa8` | mint `#9fe3c9` |
| kiko | Kiko | L8 | `#ffa552` cam | tóc bob | kẹp ngôi sao vàng `#ffe066` | vàng `#ffd95e` |
| momo | Momo | L16 | `#4f5fae` xanh navy | tóc dài thẳng | mũ beret tím `#b878e8` | hồng `#ffb3c7` |

- Tỉ lệ chibi: đầu to (~55 % chiều cao nhân vật), mắt to, da `skin` trong `STREAMERS`.
- Vị trí miệng: tâm mặt + (0, 0.42 × bán kính). Game dùng điểm này để kiểm tra kéo món tới miệng, nên **ghi đúng toạ độ miệng vào manifest**.
- Nhân vật còn hiện nhỏ ở: thẻ chọn streamer, avatar tròn HUD (`profileBadge`), khung nhỏ ở siêu thị. Bộ lớp trên dùng được cho mọi chỗ; không cần hình riêng.

### C. Nền livestream — `assets/bg/<id>.jpg`

- **1080×2400** JPG, mỗi file ≤ 180 KB. Nửa dưới (từ ~48 % chiều cao) bị khăn bàn caro (vẽ bằng code) che, nên **nội dung chính nằm ở 0–50 %**. Đường chân trời ~45–50 %.
- Đầu streamer nằm giữa, tâm ở ~30 % chiều cao, nên giữa ảnh không để chi tiết rối.
- Mép trên ~12 % có HUD (LIVE, coin): để trời/nền đơn giản.

| id | Tên | Dùng ở level | Nội dung |
|---|---|---|---|
| park | Sunny Park | 1–6 | trời xanh nhạt, mây, đồi cỏ, cây tròn, hoa nhỏ |
| beach | Sunset Beach | 7–12 | hoàng hôn cam-hồng, mặt trời, núi hồng xa, biển, sóng trắng, dừa, quầy nhỏ |
| sakura | Sakura River | 13–18 | trời hồng, cây anh đào, dải cỏ, sông xanh |
| room | Cozy Room | 19–24 | phòng tím nhạt, cửa sổ trời đêm có trăng, kệ thú bông, đèn dây |
| city | Neon City | 25–30 | đêm tím xanh, sao, trăng khuyết, nhà cao tầng cửa sổ sáng, biển neon trống (không chữ) |

Lớp động tuỳ chọn (PNG nhỏ, game tự cho trôi): `fx_cloud.png` (park, beach), `fx_petal.png` (sakura), `fx_twinkle.png` (city).

### D. Siêu thị & quầy quét — `assets/store/`

| File | Kích thước | Ghi chú |
|---|---|---|
| `store_bg.jpg` | 1080×2400 | trong siêu thị pastel, tường + sàn ô, mờ/ít chi tiết vì kệ và món đè lên |
| `shelf_board.png` | 1008×60 | thanh kệ gỗ/nhựa ngang, **màu trung tính** (code tô màu theo kệ) hoặc làm 6 bản theo `CATS[].dark` |
| `basket.png` | 360×200 | giỏ nhựa hồng `#ff9fc4` có quai, nhìn chính diện; neo = giữa mép trên miệng giỏ (món đặt nhô lên trên) |
| `checkout_machine.png` | 864×920 | máy tự thanh toán tím `#c9a8ff`, 2 "tai" tròn trên đỉnh, màn hình lớn sáng **để trống** (code vẽ hoá đơn lên), khe quét đen có vạch laser đỏ ở dưới. Ghi rect màn hình + rect khe quét vào manifest |
| `conveyor.png` | 1000×240 | băng chuyền lavender có vạch ngang, có thể **kéo dãn theo chiều cao** (9-slice; ghi vùng giữa vào manifest) |
| `cashier_bear.png` | 256×280 | gấu nâu `#c99b6a` đội mũ lưỡi trai xanh, áo mint, mặt cười; hiện trên màn hình máy khi "Thank you!" |

### E. HUD / icon — `assets/ui/`

- `icons.png` atlas, mỗi ô 96×96: `coin` (đồng vàng có `$`), `star_on`, `star_off` (xám, cho sao chưa đạt), `heart`, `lock` (ổ khoá vàng), `eye` (icon lượt xem, trắng), `plus_coin`.
- `reactions.png` atlas, ô 64×64, 7 emoji bay lên khi stream: `heart`, `like` (ngón cái trên tròn xanh), `star`, `laugh`, `love` (mắt tim), `cool` (kính râm), `smile`. Mặt emoji vàng `#ffc83d`.
- `avatars.png` atlas, ô 72×72, avatar tròn viền trắng cho chat: `cat`, `dog`, `bunny`, `duck`, `bear`, `frog`, `pig` (mặt thú đơn giản, má hồng).
- `phone_stick.png` 200×360: điện thoại xanh trên gậy selfie (camera ở trên), đặt ở cạnh trái màn stream, neo = đầu dưới gậy.

### F. Logo & icon app

- `assets/ui/logo.png` **900×420**: chữ "MUKBANG" (trắng viền hồng đậm `#e8759a`) trên, "BANG" (vàng `#ffd95e` viền hồng đậm) to hơn ở dưới, kiểu chữ tròn mập, có thể thêm đũa/bát mì nhỏ. Thay cho `ui.title('MUKBANG'…)` ở màn Home.
- `icon-512.png` **512×512** (để **ngoài** `mukbang-bang/`, ở thư mục gốc repo, vì Android pack cần, không upload TikTok): Luna đang ăn mì, nền hồng, không chữ.

---

## 5. `assets/manifest.json`

```json
{
  "version": 1,
  "scale": 2,
  "food":    { "size": 256, "anchor": [128, 128] },
  "streamer": {
    "luna": { "body": "streamer/luna_body.png", "head": "streamer/luna_head.png",
              "headAnchor": [256, 256], "neckOnHead": [256, 470], "faceRadius": 190, "mouth": [256, 336] },
    "kiko": { "...": "..." }, "momo": { "...": "..." }
  },
  "faceParts": { "image": "streamer/face_parts.png",
                 "frames": { "eyes_open": { "x": 0, "y": 0, "w": 240, "h": 90, "at": [256, 230] } } },
  "atlases": {
    "icons":     { "image": "ui/icons.png",     "frames": { "coin": { "x": 0, "y": 0, "w": 96, "h": 96 } } },
    "reactions": { "image": "ui/reactions.png", "frames": {} },
    "avatars":   { "image": "ui/avatars.png",   "frames": {} }
  },
  "store": { "checkout_machine": { "screen": [48, 48, 768, 600], "slot": [260, 700, 344, 120] },
             "conveyor": { "slice": [40, 40, 920, 160] } }
}
```

Toạ độ đều tính bằng pixel của ảnh 2×. `at` = vị trí tâm bộ phận trên ảnh head.

## 6. Nếu được giao tích hợp (không làm khi chưa được yêu cầu)

- Thêm `src/assets.js`: nạp ảnh bằng `tt.createImage()` qua adapter trong `game.js` (web: `new Image()`). Hiện màn chờ nạp ở Home.
- Trong `art.js`, mỗi hàm (`food`, `streamer`, `background`, `basket`…) **dùng sprite nếu đã nạp, nếu chưa thì giữ code vẽ cũ làm fallback**. Không xoá code vẽ.
- `food(ctx, f, x, y, size, e)` → stage = `Math.min(bites-1, Math.floor(e * bites))`.
- `tools/build-web.mjs`: nhúng `assets/` dạng data URI.
- Bắt buộc sau khi sửa: `node _kit/hs-sdk-1.1.3/hs-check.mjs mukbang-bang` → **0 ❌**, `node tools/sim-test.mjs` → **all passed**. Không sửa `hs-game.js`, `hs-sdk.min.js`. Không đặt gì ngoài game vào `mukbang-bang/`.

## 7. Thứ tự giao gợi ý

1. Mẫu duyệt style: 1 món mỗi kệ (6 món, đủ stage) + Luna (body, head, face parts) + nền `park`. **Dừng chờ chủ dự án duyệt.**
2. Toàn bộ món ăn (A).
3. Kiko, Momo + 4 nền còn lại (B, C).
4. D, E, F + manifest hoàn chỉnh + báo cáo dung lượng.
