# Kiểm tra art V3 đợt 1 (art-v3-production.zip) với code hiện tại

Ngày 03/11/2026. Đối chiếu ZIP art với `docs/GAME-DESIGN-V3.md`, `mukbang-bang/src/sprites.js` và `src/art.js` trong repo. Repo đang ở **V4** (nấu trước, stream sau). Gói hàng đóng sẵn của V3 (`food3`) nay chỉ dùng cho các hoạt động phụ: Shop, Delivery, Buffet, Surprise.

## 1. Bên trong ZIP

| Thư mục | Nội dung | Dùng? |
|---|---|---|
| `V3-stage1-partial/` | 83 ảnh, chia gói: `assets/` = main, `art3/assets/food3/` = art3. Manifest v3 đầy đủ (status, pending, packageBytes, backgrounds). Có 3 ảnh xem trước. | ✅ **bản để tích hợp** |
| `stage1/` | cùng 83 ảnh, nhưng `food3` nằm trong `assets/`, không tách thư mục `art3` | trùng, bỏ |
| `assets/` (gốc ZIP) | bản làm việc cũ (15:03): 95 ảnh, manifest thiếu `package`, `status`, `backgrounds`. Có **Soda Pop và Rainbow Candy bản sinh sai**: soda_pop là chai kèm hộp mochi, rainbow_candy là khay thạch sao chứ không phải túi | ❌ **không dùng** |

Trong `V3-stage1-partial` có đủ mọi file manifest khai báo, không thiếu file nào. Hai món còn thiếu (`food3/soda_pop_*`, `food3/rainbow_candy_*`) đã nằm trong `pending`.

## 2. Chỗ lệch giữa manifest v3 và `src/sprites.js` (bộ nạp V1)

| Mục | Code hiện tại (V1) | Art V3 | Việc khi tích hợp |
|---|---|---|---|
| Món ăn | `food/<id>_<0..n>.png` 256 px, mỗi frame là một miếng cắn | `food3/<id>_{sealed,open,p1,p2,empty,portion}.png` 512 px, neo [256,256] | đọc trạng thái theo phase: sealed → opening/open → p1/p2 theo số lần gắp → empty. `portion` dùng cho miếng đang được đưa vào miệng (đã vẽ sẵn đũa/thìa) |
| Gói chứa | mọi thứ ở main `assets/` | `package: art3` → subpackage | khai báo subpackage `art3` trong `game.json`, gọi `loadSubpackage` trước khi mở hoạt động phụ. Trong lúc chờ thì dùng vector fallback |
| Neo streamer | hard-code: faceRadius 160, luna [256,350]… | faceRadius **137 / 137 / 128**; headAnchor luna [256,352], kiko [256,365], momo [256,334]; bodyAnchor 49/46/36; thêm `hairTop`, `earL`, `earR` | đọc từ manifest. Tỉ lệ đầu phải tính theo từng streamer (80 / faceRadius), không cố định 0.5, nếu không mặt sẽ nhỏ đi khoảng 15–20% |
| Mắt/miệng | `face_parts.png` lưới 4×5, 20 tên V1; vị trí mặt cố định theo Luna | atlas 4×6 với **22 frame** có toạ độ riêng; FX tách sang `face_fx.png` (6 frame) | dùng `atlases.face_parts`/`face_fx` và `eyes`/`mouth` riêng của từng streamer |
| Biểu cảm | 9: idle, open, chew, yum, spicy, cold, sweet, fizzy, sour | 12: thêm **blink**, **viral**; tách `chew` thành `chew_a`/`chew_b` | khi nhai thì xen kẽ chew_a/b; dùng viral cho finale và MISSION COMPLETE |
| UI | atlas `ui/icons.png`, `reactions.png`, `avatars.png`, `logo.png`, `phone_stick.png` | các file rời: coin, star_on/off, heart_float, live_pill, logo_v3, goal_bar, pip_on/off, 4 banner, `btn_start` và `result_panel` (có thông số 9-slice), gift_box, food_book, 4 icon activity | dùng file rời. Reactions, avatars, phone_stick và store **không có trong V3** nên giữ bản V1 |
| Phòng stream | vẽ vector; cửa sổ ở **16–84% ngang × 7–38% dọc** | `bg/home_room.png` có alpha thật ở **x216–839, y191–776 (20–78% × 8–32%)** | đặt cảnh chương vào đúng `windowAlphaBounds` (cover trong khung đó). Không vẽ lại khung cửa vector |
| Cảnh ngoài cửa sổ | 5 nền V1 (park…city) | **chưa giao** (`view_*.jpg`) | tạm dùng nền V1, crop vào vùng cửa sổ |

Bố cục phòng mới khác bản vector ở 2 chỗ:
- **Ring light bên trái** trùng chỗ game vẽ gậy selfie (`phone_stick`). Nên bỏ gậy selfie khi dùng phòng bitmap.
- **Kệ thú bông bên phải** nằm sau thẻ LIVE. Cần dời thẻ LIVE lên trên khoảng 4% hoặc thu nhỏ lại.

Bàn ăn của game che từ khoảng 52% chiều cao trở xuống, mà nền phòng ở đó chỉ là sàn trơn, nên không bị vướng.

`activity_pan.png` (hoạt động Kitchen của V3) đã bị bỏ trong V4. Có thể dùng làm icon cho nút MAKE hoặc màn bếp.

## 3. Dung lượng

- Hiện tại gói là 3,19 MB: code khoảng 0,52 MB, art V1 2,67 MB, trong đó món ăn V1 1,41 MB.
- Sau tích hợp, main ước tính **≈ 2,9–3,0 MB**: code + V3 main (1,59 MB) + phần V1 còn giữ (ui 0,2, store 0,31, nền view 0,34). Trong đó **bỏ** streamer V1 (0,38 MB) và **chuyển** món ăn V1 sang subpackage. Vẫn dưới mức 4 MB.
- `art3` là 5,10 MB **chỉ cho 8 món**, tức khoảng 640 KB mỗi món (6 ảnh × 512 px). Nếu giữ chất lượng này cho 41 món như brief V3 thì phải khoảng 26 MB, quá lớn.
  - Đề xuất: món ăn chỉ hiện khoảng 150 px logic (300 px ở 2×), nên **xuất 320 px** và chạy pngquant, ước tính khoảng 250 KB mỗi món.
  - V4 chỉ dùng món đóng gói cho hoạt động phụ, nên có thể **giảm số món** xuống 16–20.
  - Cần kiểm tra giới hạn subpackage và tổng dung lượng của TikTok Minis trước khi chốt.

## 4. Việc tiếp theo (khi chủ dự án đồng ý tích hợp)

1. Viết bộ nạp manifest v3 (đọc `files[].package`, food states, atlases, anchors), giữ đường V1 và vector làm fallback.
2. Thêm subpackage `art3` vào `game.json` và cho hs-check chạy qua bước đó.
3. Ghép phòng theo `windowAlphaBounds`, rồi bỏ gậy selfie và dời thẻ LIVE.
4. `sim-test`: kiểm tra mọi đường ảnh được yêu cầu đều có file, chạy lại cả ở bản web.
5. Chờ Codex giao Soda Pop, Rainbow Candy và 5 `view_*.jpg`.
