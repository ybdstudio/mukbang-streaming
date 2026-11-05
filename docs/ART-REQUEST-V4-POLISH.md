# Mukbang Bang — yêu cầu art V4 "polish" (cho Codex)

Ngày 05/11/2026. Đã ghép vào game:
- toàn bộ art bếp V4 (core + next);
- art V3 đợt 1: streamer mới, phòng stream, mặt, đồ ăn đóng gói, logo, coin, sao.

Ảnh game hiện tại nằm ở `refs/`. Đợt này gồm 4 nhóm nhỏ, xếp theo thứ tự ưu tiên. Danh sách file đầy đủ: `CHECKLIST-V4-POLISH.csv`.

Kỹ thuật giữ nguyên như các đợt trước:
- PNG palette có alpha, không dither, có padding;
- kèm manifest fragment (kích thước, neo, package, SHA256), registration và preview;
- lớp `_fill` vẽ xám trung tính (khoảng 120–235/255) để game nhân màu vào; lớp `_detail` không tô màu.

Ngân sách:
- Gói main còn khoảng **0,5 MB**. Chỉ đặt vào main những file ghi `main` trong checklist.
- Các subpackage `art3` và `art4` mỗi gói phải ≤ 4 MB (hiện 1,83 MB và 1,03 MB).

---

## 1. Miếng ăn ở miệng streamer — `art4/bite/` (ưu tiên 1)

Chủ dự án yêu cầu cảnh ăn "ngon miệng hơn" và đồ ăn "hao đi từng miếng".

Hiện tại code tự cắt vết cắn từ hình món, và tự vẽ mì trên đũa. Xem `refs/eating-now.png`.

Cần vẽ **miếng ăn cầm trước miệng**, mỗi miếng có 3 trạng thái:
- `_0`: nguyên;
- `_1`: đã cắn 1 miếng;
- `_2`: còn miếng cuối.

Sau miếng thứ 3 thì game cho miếng ăn biến mất.

Quy cách:
- canvas **400×400**, neo [200, 200];
- phía cắn hướng lên trên, phía tay / thìa / đũa ở dưới;
- vết cắn tròn, có vụn nhỏ, rõ ràng ở cỡ hiển thị khoảng 150 px.

| file (×3 trạng thái `_0` `_1` `_2`) | lớp | nội dung |
|---|---|---|
| `jelly_spoon_<k>_fill` + `_detail` | fill tô theo **vị** | thìa nhựa xúc một khối thạch rung rinh; khối nhỏ dần qua 3 trạng thái |
| `pudding_spoon_<k>_fill` + `_detail` | fill tô theo vị; caramel nằm trong detail | như thạch, có mũ caramel nâu |
| `cupcake_bite_<k>_fill` + `_detail` | fill = kem, tô theo vị; bánh và cốc giấy nằm trong detail | cupcake cầm tay, vết cắn ăn vào kem và bánh |
| `donut_bite_<k>_fill` + `_detail` | fill = glaze, tô theo vị | donut vòng cầm tay, vết cắn lớn dần |
| `parfait_spoon_<k>_fill` + `_detail` | fill = lớp thạch / sốt, tô theo vị | thìa dài xúc kem và các lớp |
| `bingsu_spoon_<k>_fill` + `_detail` | fill = siro, tô theo vị | thìa xúc đá bào phủ siro |
| `ramen_chopsticks_<k>` | màu thật (mì vàng) | đũa gắp mì vàng óng; búi mì ngắn dần, có giọt nước dùng |

Boba không cần art: game cho ly cạn dần.

## 2. Hiệu ứng nấu — `assets/cook/` (ưu tiên 2, main)

Mỗi file là atlas 4 frame 128×128 xếp ngang (512×128):
- `fx_steam.png`: hơi nóng bốc lên;
- `fx_cold.png`: bông tuyết / hơi lạnh khi quạt cho thạch đông;
- `fx_pour.png`: dòng chảy, **xám trung tính** để game tô theo vị;
- `fx_sparkle.png`: lấp lánh khi xong bước.

## 3. Xuất lại `pip_on.png` — `assets/cook/` (ưu tiên 2)

Bản hiện tại bị mờ ở 40×40. Cần xuất lại sắc nét, cùng phong cách với `pip_off.png`, nên vẽ từ nguồn lớn rồi thu nhỏ.

## 4. Phần còn thiếu của V3 — `art3/` (ưu tiên 3)

- **Soda Pop** (chai, mở kiểu `bottle`) và **Rainbow Candy** (túi, mở kiểu `bag`).
  - Mỗi món 6 trạng thái: `sealed`, `open`, `p1`, `p2`, `empty`, `portion`.
  - File: `art3/food3/<id>_<state>.png`.
  - **Kích thước 384×384** (game đã hạ bộ food3 xuống 384), cùng bố cục với 8 món đã có.
  - Nội dung phải đúng brief V3: soda pop là chai soda hồng có bọt, rainbow candy là túi kẹo cầu vồng. Lần sinh đầu bị sai cả hai.
- **5 cảnh ngoài cửa sổ phòng stream:** `art3/bg/view_park|view_beach|view_sakura|view_night|view_city.jpg`.
  - Kích thước **720×680**, JPEG q80.
  - Game đặt ảnh phủ kín cửa sổ của `home_room` (vùng x216–839, y191–776 trên canvas 1080×2400) và căn theo khoảng 35% từ trên xuống.
  - Đường chân trời đặt ở khoảng 55% chiều cao ảnh. Không vẽ khung cửa vào ảnh.

---

## Đợt sau (không làm trong đợt này): Wardrobe

Game đã chạy streamer V3, nên đồ Wardrobe giờ vẽ được theo đúng neo V3: `hairTop`, `earL`, `earR`, `eyes`, `mouth`, `neckOnHead`, `faceRadius` 137/137/128, ghi trong `refs/streamer-v3-anchors.json`. Spec chi tiết vẫn theo `ART-REQUEST-V4.md` §1. Chủ dự án sẽ báo khi bắt đầu.
