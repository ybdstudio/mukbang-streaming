# Mukbang Bang — yêu cầu art Wardrobe (cho Codex)

Ngày 05/11/2026. Chủ dự án nhận xét trang phục hiện tại "khá xấu".

Lý do: toàn bộ đồ trong Wardrobe đang là **hình vector tạm do code vẽ** (xem `refs/wardrobe-now.png`), chỉ có áo len đổi màu là dùng body bitmap. Đợt này thay toàn bộ bằng art thật.

Game đã chạy **streamer V3** do Codex giao ở đợt 1. Đồ phải vẽ **trên đúng canvas** của các file V3:
- `refs/streamer/<id>_head.png` (512×512)
- `refs/streamer/<id>_body.png` (512×420)

Như vậy game chỉ cần đặt chồng lên, không phải căn lại.

Điểm neo của từng streamer nằm trong `refs/streamer-v3-anchors.json`:
- `faceRadius` 137 / 137 / 128;
- `eyes`, `mouth`, `hairTop`, `earL`, `earR`, `neckOnHead`, `bodyAnchor`.

Phong cách giữ đúng như streamer V3 đã duyệt: viền nâu ấm, pastel, bóng mềm.

Kỹ thuật như các đợt trước:
- PNG palette có alpha, không dither;
- kèm manifest fragment (kích thước, neo, package, SHA256);
- kèm 1 ảnh preview ghép.

Danh sách đầy đủ: `CHECKLIST-WARDROBE.csv`, 78 file.

## 1. Quy tắc ghép (đọc trước)

- **Outfit** là lớp phủ trên **body**: canvas **512×420**, trùng vị trí với `<id>_body.png`.
  - Vẽ phần áo/đồ che lên áo len gốc.
  - Hai bàn tay đặt trên bàn phải lộ ra như ảnh gốc. Nếu đồ che tay thì vẽ lại tay.
  - Áo len đổi màu (`outfit_mint`, `outfit_sunny`, `outfit_sakura`) là **thân áo hoàn chỉnh**, che kín áo gốc.
- **Hair** và **Extras** là lớp phủ trên **head**: canvas **512×512**, trùng vị trí với `<id>_head.png`.
  - Đồ trên tóc phải **ôm theo kiểu tóc** của từng người: búi to (Luna), tóc ngắn xù có lọn dựng (Kiko), tóc dài thẳng (Momo).
  - Không để đồ lơ lửng.
- **Không che mắt và miệng.** Game thay mắt và miệng theo biểu cảm (nhai, cay, viral…).
  - Kính dùng tròng trong khoảng 25% và không vẽ mắt vào kính.
  - Sticker má chỉ nằm trên má.
- **Vẽ cho cả 3 streamer** (`luna`, `kiko`, `momo`). Tên file: `art5/wardrobe/<item_id>_<streamer>.png`.
- **Icon lưới Wardrobe:** `assets/wardrobe/icon_<item_id>.png` 128×128, neo [64, 64]. Item đứng riêng, không có người, nằm giữa ô.

## 2. Danh sách item (id khớp `src/wardrobe.js`)

**OUTFITS** (512×420, lớp body)

| id | tên | mô tả |
|---|---|---|
| `outfit_mint` | Mint Sweater | len mint `#9fe3c9`, bóng `#5fbf9f`, cổ tròn, 1 tim trắng nhỏ ở ngực |
| `outfit_bib` | Mukbang Bib | yếm ăn trắng hồng `#fff3f7`, viền diềm, chữ "YUM" nhỏ thêu, đeo đè lên áo len gốc |
| `outfit_sunny` | Sunny Sweater | len vàng `#ffd95e`, bóng `#e0b52a`, hoạ tiết mặt trời nhỏ |
| `outfit_sakura` | Sakura Sweater | len hồng `#ffb3c7`, bóng `#e8759a`, rải cánh hoa anh đào |
| `outfit_chef` | Chef Apron | tạp dề đầu bếp trắng có túi trước, dây buộc sau cổ, đè lên áo gốc |
| `outfit_star` | Star Overalls | quần yếm lavender `#cdb0ff`, 2 cúc sao vàng, ngôi sao lớn ở yếm, đè lên áo gốc |

**HAIR** (512×512, lớp head)

| id | tên | mô tả |
|---|---|---|
| `hair_bow` | Big Bow | nơ to hồng `#ff7fa8` trên đỉnh đầu, lệch phải |
| `hair_star` | Star Clip | kẹp sao vàng nhỏ trên mái, lệch trái |
| `hair_cat_ears` | Cat Ears | băng đô tai mèo, trong tai hồng |
| `hair_beret` | Red Beret | mũ nồi đỏ `#e8403a` đội nghiêng, có núm nhỏ; ôm đầu, không che mắt |
| `hair_flowers` | Flower Crown | vòng hoa nhỏ (hồng, vàng, trắng) kèm lá |
| `hair_bunny_ears` | Bunny Ears | băng đô tai thỏ trắng dựng, 1 tai gập |
| `hair_crown` | Star Crown | vương miện vàng `#ffd23f` 3 đỉnh, đỉnh giữa hình sao, có lấp lánh |

**EXTRAS** (512×512, lớp head)

| id | tên | mô tả | vị trí |
|---|---|---|---|
| `acc_blush` | Heart Stickers | 2 sticker tim hồng trên má | dưới `eyes`, hai bên |
| `acc_glasses_round` | Round Glasses | kính tròn gọng nâu, tròng trong | trên `eyes` |
| `acc_headphones` | Headphones | tai nghe chụp pastel, vòng qua đỉnh đầu | `earL`, `earR` |
| `acc_heart_glasses` | Heart Glasses | kính tim hồng, tròng hồng nhạt trong suốt | trên `eyes` |
| `acc_scarf` | Cozy Scarf | khăn len kẻ sọc quấn cổ, có đuôi khăn | `neckOnHead` |

`outfit_default`, `hair_none` và `acc_none` không cần lớp phủ.

Icon cần cho mọi item, kể cả `outfit_default` (áo len trơn). `hair_none` và `acc_none` không cần icon: game đã có biểu tượng "không đeo".

## 3. Bộ phối (themed looks): kiểm tra khi mặc đủ bộ

- **CHEF LOOK** = `outfit_chef` + (không đồ tóc) + `acc_glasses_round`
- **KITTY LOOK** = `outfit_sakura` + `hair_cat_ears` + `acc_blush`
- **SUPERSTAR** = `outfit_star` + `hair_crown` + `acc_heart_glasses`

Giao kèm `preview-looks.png`: lưới 3×3 (3 streamer × 3 bộ), mỗi ô ghép đủ body + outfit + head + mắt/miệng `idle` + hair + extras.

## 4. UI Wardrobe — `assets/wardrobe/` (main)

- `tab_outfit.png`, `tab_hair.png`, `tab_extras.png`: icon tab 96×96.
- `badge_ad.png` 120×40: nhãn "▶ UNLOCK" nền xanh, dùng cho mở sớm bằng quảng cáo.
- `badge_gift.png` 120×40: hộp quà nhỏ kèm khoá, dùng cho "GIFT · LV n".

## 5. Ngân sách

- 54 lớp phủ đặt trong **subpackage mới `art5`**, giới hạn ≤ 4 MB. Mục tiêu ≤ 45 KB mỗi lớp.
- 19 icon và 5 file UI đặt trong main. Mục tiêu tổng ≤ 0,15 MB, vì main chỉ còn khoảng 0,5 MB.

## 6. Thứ tự giao

1. Bảng mẫu gồm Luna mặc đủ 3 bộ phối. Dừng chờ chủ dự án duyệt.
2. Phần còn lại cho cả 3 streamer, kèm icon và UI.
